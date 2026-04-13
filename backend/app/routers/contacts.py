from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.user import Team, User
from app.schemas.user import UserRead
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[UserRead])
def get_contacts(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(User).options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization)).filter(User.is_active.is_(True))
    if current_user.role != "SUPER_ADMIN":
        query = query.filter(User.organization_id == current_user.organization_id)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter((User.full_name.ilike(like)) | (User.email.ilike(like)) | (User.title.ilike(like)))
    return query.order_by(User.full_name.asc()).all()
