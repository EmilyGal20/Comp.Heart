from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    title: str,
    message: str,
    organization_id: int,
    type_: str,
    severity: str,
    user_id: int | None = None,
    role_target: str | None = None,
    is_org_wide: bool = False,
) -> Notification:
    notification = Notification(
        title=title,
        message=message,
        organization_id=organization_id,
        type=type_,
        severity=severity,
        user_id=user_id,
        role_target=role_target,
        is_org_wide=is_org_wide,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
