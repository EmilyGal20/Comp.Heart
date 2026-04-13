from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import get_dashboard_summary
from app.utils.dependencies import get_current_user, resolve_org_scope


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return get_dashboard_summary(db, current_user=current_user, organization_id=scoped_org_id)
