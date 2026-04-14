from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.user import Team, User
from app.schemas.user import UserRead
from app.utils.dependencies import get_current_user
from app.utils.pagination import paginate_query


router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("")
def get_contacts(
    search: str | None = Query(default=None),
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=18, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(User).options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization)).filter(User.is_active.is_(True))
    if current_user.role != "SUPER_ADMIN":
        query = query.filter(User.organization_id == current_user.organization_id)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter((User.full_name.ilike(like)) | (User.email.ilike(like)) | (User.title.ilike(like)))
    ordered = query.order_by(User.full_name.asc())
    return paginate_query(ordered, page=page, page_size=page_size) if paginated else ordered.all()
