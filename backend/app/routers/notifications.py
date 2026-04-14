from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationBulkReadRequest, NotificationRead
from app.utils.pagination import paginate_query
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    severity: str | None = Query(default=None),
    type: str | None = Query(default=None),
    source: str | None = Query(default=None),
    organization_id: int | None = Query(default=None),
    unread_only: bool = Query(default=False),
    search: str | None = Query(default=None),
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).options(joinedload(Notification.user).joinedload(User.team))
    if current_user.role != "SUPER_ADMIN":
        query = query.filter(Notification.organization_id == current_user.organization_id)
    elif organization_id:
        query = query.filter(Notification.organization_id == organization_id)
    if current_user.role == "USER":
        query = query.filter(
            (Notification.user_id == current_user.id)
            | (Notification.is_org_wide.is_(True))
            | (Notification.role_target == current_user.role)
        )
    if severity:
        query = query.filter(Notification.severity == severity)
    if type:
        query = query.filter(Notification.type == type)
    if source:
        query = query.filter(Notification.type == source)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    if search:
        pattern = f"%{search.lower()}%"
        query = query.filter((Notification.title.ilike(pattern)) | (Notification.message.ilike(pattern)))
    ordered = query.order_by(Notification.created_at.desc())
    return paginate_query(ordered, page=page, page_size=page_size) if paginated else ordered.all()


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


@router.patch("/read-all")
def mark_all_notifications_as_read(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification)
    if current_user.role != "SUPER_ADMIN":
        query = query.filter(Notification.organization_id == current_user.organization_id)
    elif organization_id:
        query = query.filter(Notification.organization_id == organization_id)
    if current_user.role == "USER":
        query = query.filter(
            (Notification.user_id == current_user.id)
            | (Notification.is_org_wide.is_(True))
            | (Notification.role_target == current_user.role)
        )
    count = query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"updated": count}


@router.patch("/bulk-read")
def bulk_mark_notifications_as_read(
    payload: NotificationBulkReadRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = db.query(Notification).filter(Notification.id.in_(payload.ids)).all()
    updated = 0
    for notification in items:
        if current_user.role != "SUPER_ADMIN" and notification.organization_id != current_user.organization_id:
            continue
        if current_user.role == "USER" and notification.user_id not in {None, current_user.id} and not notification.is_org_wide:
            continue
        notification.is_read = True
        updated += 1
    db.commit()
    return {"updated": updated}
