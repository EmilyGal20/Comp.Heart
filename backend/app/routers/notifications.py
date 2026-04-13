from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationRead
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_notifications(
    severity: str | None = Query(default=None),
    unread_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).options(joinedload(Notification.user).joinedload(User.team))
    if current_user.role != "SUPER_ADMIN":
        query = query.filter(Notification.organization_id == current_user.organization_id)
    if current_user.role == "USER":
        query = query.filter(
            (Notification.user_id == current_user.id)
            | (Notification.is_org_wide.is_(True))
            | (Notification.role_target == current_user.role)
        )
    if severity:
        query = query.filter(Notification.severity == severity)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.created_at.desc()).all()


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_as_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if current_user.role != "SUPER_ADMIN" and notification.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    if current_user.role == "USER" and notification.user_id not in {None, current_user.id} and not notification.is_org_wide:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification
