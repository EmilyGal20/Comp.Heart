from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.automation import AutomationRule
from app.models.knowledge import KnowledgeItem
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.task import Task
from app.models.user import Team, User
from app.services.audit_service import log_audit_event


def create_organization(db: Session, payload):
    organization = Organization(**payload.model_dump())
    db.add(organization)
    db.flush()
    log_audit_event(db, organization_id=organization.id, user_id=None, action="organization_created", entity_type="Organization", entity_id=organization.id, details=organization.name)
    db.commit()
    db.refresh(organization)
    return organization


def update_organization(db: Session, organization: Organization, payload):
    for field, value in payload.model_dump().items():
        setattr(organization, field, value)
    db.add(organization)
    log_audit_event(db, organization_id=organization.id, user_id=None, action="organization_updated", entity_type="Organization", entity_id=organization.id, details=organization.name)
    db.commit()
    db.refresh(organization)
    return organization


def set_organization_status(db: Session, organization: Organization, is_active: bool):
    organization.is_active = is_active
    db.add(organization)
    log_audit_event(db, organization_id=organization.id, user_id=None, action="organization_status_updated", entity_type="Organization", entity_id=organization.id, details=str(is_active))
    db.commit()
    db.refresh(organization)
    return organization


def get_organization_summary(db: Session, organization: Organization):
    latest_notification = (
        db.query(Notification)
        .filter(Notification.organization_id == organization.id)
        .order_by(Notification.created_at.desc())
        .first()
    )
    return {
        "organization": organization,
        "user_count": db.query(func.count(User.id)).filter(User.organization_id == organization.id).scalar() or 0,
        "team_count": db.query(func.count(Team.id)).filter(Team.organization_id == organization.id).scalar() or 0,
        "task_count": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id).scalar() or 0,
        "overdue_tasks": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id, Task.sla_status == "breached").scalar() or 0,
        "knowledge_count": db.query(func.count(KnowledgeItem.id)).filter(KnowledgeItem.organization_id == organization.id).scalar() or 0,
        "unread_notifications": db.query(func.count(Notification.id)).filter(Notification.organization_id == organization.id, Notification.is_read.is_(False)).scalar() or 0,
        "latest_activity": latest_notification.title if latest_notification else "No recent activity",
    }


def list_organizations(db: Session):
    organizations = db.query(Organization).order_by(Organization.name.asc()).all()
    return [get_organization_summary(db, organization) for organization in organizations]


def organization_users(db: Session, organization_id: int):
    return db.query(User).filter(User.organization_id == organization_id).order_by(User.full_name.asc()).all()


def organization_teams(db: Session, organization_id: int):
    return db.query(Team).filter(Team.organization_id == organization_id).order_by(Team.name.asc()).all()


def organization_overview(db: Session):
    organizations = db.query(Organization).order_by(Organization.name.asc()).all()
    comparison = []
    for organization in organizations:
        comparison.append(
            {
                "id": organization.id,
                "name": organization.name,
                "slug": organization.slug,
                "company_type": organization.company_type,
                "industry": organization.industry,
                "status": "active" if organization.is_active else "inactive",
                "users": db.query(func.count(User.id)).filter(User.organization_id == organization.id).scalar() or 0,
                "teams": db.query(func.count(Team.id)).filter(Team.organization_id == organization.id).scalar() or 0,
                "tasks": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id).scalar() or 0,
                "overdue_tasks": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id, Task.sla_status == "breached").scalar() or 0,
                "knowledge_items": db.query(func.count(KnowledgeItem.id)).filter(KnowledgeItem.organization_id == organization.id).scalar() or 0,
                "notifications": db.query(func.count(Notification.id)).filter(Notification.organization_id == organization.id).scalar() or 0,
                "automations": db.query(func.count(AutomationRule.id)).filter(AutomationRule.organization_id == organization.id, AutomationRule.is_enabled.is_(True)).scalar() or 0,
                "latest_activity": (
                    db.query(Notification.title)
                    .filter(Notification.organization_id == organization.id)
                    .order_by(Notification.created_at.desc())
                    .limit(1)
                    .scalar()
                    or "No recent activity"
                ),
            }
        )
    return comparison
