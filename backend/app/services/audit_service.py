from sqlalchemy.orm import Session, joinedload

from app.models.work_management import AuditLog
from app.models.user import User


def log_audit_event(
    db: Session,
    *,
    organization_id: int,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: str | None = None,
):
    entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(entry)
    db.flush()
    return entry


def list_audit_logs(db: Session, *, organization_id: int | None = None, limit: int = 50):
    query = db.query(AuditLog).options(joinedload(AuditLog.user).joinedload(User.team))
    if organization_id is not None:
        query = query.filter(AuditLog.organization_id == organization_id)
    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
