from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_ADMIN, ROLE_SUPER_ADMIN
from app.db.session import get_db
from app.models.task import Task, TaskActivity
from app.models.user import Team, User
from app.schemas.user import UserRead
from app.services.dashboard_service import get_dashboard_summary
from app.services.organization_service import organization_overview
from app.services.task_service import list_tasks
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/global-summary")
def global_summary(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return get_dashboard_summary(db, current_user=current_user, organization_id=scoped_org_id)


@router.get("/organization-comparison")
def organization_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_SUPER_ADMIN)),
):
    return organization_overview(db)


@router.get("/users", response_model=list[UserRead])
def admin_users(
    organization_id: int | None = Query(default=None),
    role: str | None = Query(default=None),
    team_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db, allow_global=False)
    query = (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.organization_id == scoped_org_id)
    )
    if role:
        query = query.filter(User.role == role)
    if team_id:
        query = query.filter(User.team_id == team_id)
    return query.order_by(User.full_name.asc()).all()


@router.get("/tasks")
def admin_tasks(
    organization_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    team_id: int | None = Query(default=None),
    sla_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db, allow_global=False)
    return list_tasks(
        db,
        current_user=current_user,
        organization_id=scoped_org_id,
        status=status,
        priority=priority,
        team_id=team_id,
        sla_status=sla_status,
    )


@router.get("/activity")
def admin_activity(
    organization_id: int | None = Query(default=None),
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    query = db.query(TaskActivity).join(Task, Task.id == TaskActivity.task_id)
    if scoped_org_id is not None:
        query = query.filter(Task.organization_id == scoped_org_id)
    items = query.order_by(TaskActivity.created_at.desc()).limit(limit).all()
    return [{"id": item.id, "task_id": item.task_id, "event_type": item.action_type, "message": item.message, "created_at": item.created_at, "user_id": item.user_id} for item in items]
