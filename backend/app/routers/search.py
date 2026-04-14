from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.search import AISearchRequest, GlobalSearchResponse
from app.services.search_service import global_search
from app.utils.dependencies import get_current_user, resolve_org_scope


router = APIRouter(prefix="/search", tags=["search"])


@router.get("/global", response_model=GlobalSearchResponse)
def get_global_search(
    q: str = Query(..., min_length=2),
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db) if (organization_id or current_user.role != "SUPER_ADMIN") else None
    return global_search(db, query=q, current_user=current_user, organization_id=scoped_org_id, use_ai=False)


@router.post("/ai", response_model=GlobalSearchResponse)
def post_ai_search(
    payload: AISearchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = payload.query
    organization_id = payload.organization_id
    scoped_org_id = resolve_org_scope(organization_id, current_user, db) if (organization_id or current_user.role != "SUPER_ADMIN") else None
    return global_search(db, query=query, current_user=current_user, organization_id=scoped_org_id, use_ai=True)
