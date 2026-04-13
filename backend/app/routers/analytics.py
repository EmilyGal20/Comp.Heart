from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import TaskRiskRead, TeamRiskRead, UserRiskRead
from app.services.analytics_service import sla_risk_summary, team_risk_summary, user_risk_summary
from app.utils.dependencies import get_current_user, resolve_org_scope


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/sla-risk", response_model=list[TaskRiskRead])
def get_sla_risk(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return sla_risk_summary(db, organization_id=scoped_org_id)


@router.get("/user-risk", response_model=list[UserRiskRead])
def get_user_risk(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return user_risk_summary(db, organization_id=scoped_org_id)


@router.get("/team-risk", response_model=list[TeamRiskRead])
def get_team_risk(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return team_risk_summary(db, organization_id=scoped_org_id)
