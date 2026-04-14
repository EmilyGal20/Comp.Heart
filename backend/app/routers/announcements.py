from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_ADMIN
from app.db.session import get_db
from app.models.productivity import Announcement
from app.schemas.productivity import AnnouncementCreate, AnnouncementRead, AnnouncementUpdate
from app.services.productivity_service import create_announcement, list_announcements, mark_announcement_read, update_announcement
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope
from app.utils.pagination import paginate_list


router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("")
def get_announcements(
    important_only: bool = Query(default=False),
    organization_id: int | None = Query(default=None),
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if organization_id and current_user.role != "SUPER_ADMIN" and organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    items = list_announcements(db, current_user=current_user, important_only=important_only, organization_id=organization_id)
    return paginate_list(items, page=page, page_size=page_size) if paginated else items


@router.post("", response_model=AnnouncementRead)
def post_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_announcement(db, payload=payload, actor=current_user, organization_id=org_id)


@router.put("/{announcement_id}", response_model=AnnouncementRead)
def put_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if current_user.role != "SUPER_ADMIN" and announcement.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return update_announcement(db, announcement=announcement, payload=payload, actor=current_user)


@router.patch("/{announcement_id}/read")
def patch_read(announcement_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if current_user.role != "SUPER_ADMIN" and announcement.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return mark_announcement_read(db, announcement=announcement, user=current_user)
