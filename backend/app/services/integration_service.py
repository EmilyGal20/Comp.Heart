import smtplib
from email.message import EmailMessage

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.realtime import publish_event
from app.models.collaboration import OrganizationIntegration, SentEmail
from app.models.task import Task
from app.models.user import User
from app.services.audit_service import log_audit_event
from app.services.notification_service import create_notification


PROVIDERS = {"github", "slack", "email"}


def get_or_create_integration(db: Session, *, organization_id: int, provider: str):
    provider = provider.lower()
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported integration provider")
    item = (
        db.query(OrganizationIntegration)
        .filter(OrganizationIntegration.organization_id == organization_id, OrganizationIntegration.provider == provider)
        .first()
    )
    if item:
        return item
    item = OrganizationIntegration(organization_id=organization_id, provider=provider, is_enabled=False)
    item.config = {}
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_integrations(db: Session, organization_id: int):
    return {provider: get_or_create_integration(db, organization_id=organization_id, provider=provider) for provider in PROVIDERS}


def update_integration(db: Session, *, organization_id: int, provider: str, payload, actor: User):
    item = get_or_create_integration(db, organization_id=organization_id, provider=provider)
    item.is_enabled = payload.is_enabled
    item.config = payload.config
    db.add(item)
    log_audit_event(
        db,
        organization_id=organization_id,
        user_id=actor.id,
        action="integration_updated",
        entity_type="OrganizationIntegration",
        entity_id=item.id,
        details=provider,
    )
    db.commit()
    db.refresh(item)
    publish_event(
        "organization_updated",
        {"message": f"{actor.full_name} updated {provider.title()} integration settings", "provider": provider},
        organization_id=organization_id,
    )
    return item


def selectable_recipients(db: Session, *, current_user: User):
    query = db.query(User).filter(User.is_active.is_(True))
    if current_user.role == "SUPER_ADMIN":
        return query.order_by(User.full_name.asc()).all()
    return query.filter(User.organization_id == current_user.organization_id).order_by(User.full_name.asc()).all()


def _deliver_email(subject: str, body: str, recipients: list[str]):
    settings = get_settings()
    smtp_host = getattr(settings, "smtp_host", None)
    smtp_port = getattr(settings, "smtp_port", None)
    smtp_sender = getattr(settings, "smtp_sender", None)
    if not smtp_host or not smtp_port or not smtp_sender:
        return "mock"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_sender
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
        server.send_message(message)
    return "smtp"


def send_internal_email(db: Session, *, current_user: User, payload):
    recipients = db.query(User).filter(User.id.in_(payload.recipient_ids), User.is_active.is_(True)).all()
    if len(recipients) != len(set(payload.recipient_ids)):
        raise HTTPException(status_code=400, detail="One or more recipients were not found")
    if current_user.role != "SUPER_ADMIN":
        if any(user.organization_id != current_user.organization_id for user in recipients):
            raise HTTPException(status_code=403, detail="Recipients must belong to your organization")
    task = None
    if payload.task_id is not None:
        task = db.query(Task).filter(Task.id == payload.task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if current_user.role != "SUPER_ADMIN" and task.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Cross-organization task access denied")

    mode = _deliver_email(payload.subject, payload.body, [user.email for user in recipients])
    organization_id = current_user.organization_id if current_user.role != "SUPER_ADMIN" else (task.organization_id if task else recipients[0].organization_id if recipients else None)
    email_log = SentEmail(
        organization_id=organization_id,
        sender_user_id=current_user.id,
        subject=payload.subject,
        body=payload.body,
        task_id=payload.task_id,
        status="SENT" if mode in {"smtp", "mock"} else "FAILED",
    )
    email_log.recipient_ids = [user.id for user in recipients]
    db.add(email_log)
    db.flush()

    for recipient in recipients:
        create_notification(
            db,
            title="Email update received",
            message=f"{current_user.full_name} sent you: {payload.subject}",
            organization_id=recipient.organization_id,
            type_="email",
            severity="medium",
            user_id=recipient.id,
        )
        publish_event(
            "email_sent",
            {"message": f"{current_user.full_name} sent an email update", "subject": payload.subject},
            organization_id=recipient.organization_id,
            user_id=recipient.id,
        )

    log_audit_event(
        db,
        organization_id=organization_id,
        user_id=current_user.id,
        action="email_sent",
        entity_type="SentEmail",
        entity_id=email_log.id,
        details=payload.subject,
    )
    db.commit()
    db.refresh(email_log)
    return email_log, mode


def email_history(db: Session, *, current_user: User):
    query = db.query(SentEmail)
    if current_user.role != "SUPER_ADMIN":
        query = query.filter(SentEmail.organization_id == current_user.organization_id)
    return query.order_by(SentEmail.created_at.desc()).limit(40).all()
