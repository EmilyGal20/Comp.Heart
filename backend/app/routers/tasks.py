from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_MANAGER
from app.db.session import get_db
from app.schemas.task import TaskCreate, TaskRead, TaskStatusUpdate
from app.services.task_service import create_task, enrich_task, get_task_by_id, list_tasks, update_task_status
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope


router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskRead])
def get_tasks(
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    assignee_id: int | None = Query(default=None),
    organization_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    sla_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return list_tasks(
        db,
        current_user=current_user,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        organization_id=scoped_org_id,
        team_id=team_id,
        sla_status=sla_status,
    )


@router.post("", response_model=TaskRead)
def create_task_endpoint(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_MANAGER)),
):
    scoped_org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_task(db, payload, scoped_org_id)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role != "SUPER_ADMIN" and task.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    if current_user.role == "USER" and task.assignee_id != current_user.id and task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return enrich_task(task, db)


@router.patch("/{task_id}/status", response_model=TaskRead)
def patch_task_status(task_id: int, payload: TaskStatusUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    existing = get_task_by_id(db, task_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role != "SUPER_ADMIN" and existing.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    if current_user.role == "USER" and existing.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Users can only update their own tasks")
    return update_task_status(db, task_id, payload.status)
