from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_ADMIN
from app.db.session import get_db
from app.models.task import Task
from app.models.work_management import RecurringTask, Sprint, TaskApproval, TaskTemplate
from app.schemas.task import TaskRead
from app.schemas.work_management import (
    AuditLogRead,
    GlobalSearchResult,
    PermissionMatrixEntry,
    BacklogReorderRequest,
    RecurringTaskCreate,
    RecurringTaskRead,
    ReportSummary,
    SprintCreate,
    SprintRead,
    SprintStatusUpdate,
    TaskApprovalAction,
    TaskApprovalCreate,
    TaskApprovalRead,
    TaskMessageCreate,
    TaskMessageRead,
    TaskTemplateCreate,
    TaskTemplateRead,
)
from app.services.task_service import can_edit_task, can_view_task, enrich_task, get_task_by_id
from app.services.work_management_service import (
    add_task_message,
    assign_task_to_sprint,
    backlog_tasks,
    create_recurring_task,
    create_sprint,
    create_task_from_template,
    create_template,
    decide_approval,
    export_tasks_csv,
    global_search,
    list_audit_logs,
    list_recurring_tasks,
    list_sprints,
    list_task_messages,
    list_templates,
    permission_matrix,
    reorder_backlog,
    report_summary,
    request_approval,
    run_recurring_generation,
    update_sprint_status,
)
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope
from app.utils.pagination import paginate_list


router = APIRouter(prefix="/work", tags=["work-management"])


@router.get("/sprints", response_model=list[SprintRead])
def get_sprints(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db, allow_global=False)
    return list_sprints(db, scoped_org_id)


@router.post("/sprints", response_model=SprintRead)
def post_sprint(
    payload: SprintCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_sprint(db, organization_id=scoped_org_id, payload=payload, actor=current_user)


@router.patch("/sprints/{sprint_id}/status", response_model=SprintRead)
def patch_sprint_status(
    sprint_id: int,
    payload: SprintStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    scoped_org_id = resolve_org_scope(sprint.organization_id, current_user, db, allow_global=False)
    if scoped_org_id != sprint.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return update_sprint_status(db, sprint=sprint, status=payload.status, actor=current_user)


@router.get("/backlog", response_model=list[TaskRead])
def get_backlog(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db, allow_global=False)
    tasks = backlog_tasks(db, organization_id=scoped_org_id, current_user=current_user)
    return [enrich_task(task, db) for task in tasks]


@router.patch("/backlog/reorder")
def patch_backlog(
    payload: BacklogReorderRequest,
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db, allow_global=False)
    reorder_backlog(db, organization_id=scoped_org_id, ordered_ids=payload.ordered_ids, actor=current_user)
    return {"reordered": True}


@router.patch("/tasks/{task_id}/sprint", response_model=TaskRead)
def patch_task_sprint(
    task_id: int,
    sprint_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    task = get_task_by_id(db, task_id)
    if not task or not can_edit_task(current_user, task):
        raise HTTPException(status_code=404, detail="Task unavailable")
    assign_task_to_sprint(db, task=task, sprint_id=sprint_id, actor=current_user)
    return enrich_task(get_task_by_id(db, task_id), db)


@router.get("/templates", response_model=list[TaskTemplateRead])
def get_templates(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db, allow_global=False)
    return list_templates(db, scoped_org_id)


@router.post("/templates", response_model=TaskTemplateRead)
def post_template(
    payload: TaskTemplateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_template(db, organization_id=scoped_org_id, payload=payload, actor=current_user)


@router.post("/templates/{template_id}/tasks", response_model=TaskRead)
def post_task_from_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    template = db.query(TaskTemplate).filter(TaskTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    resolve_org_scope(template.organization_id, current_user, db, allow_global=False)
    return create_task_from_template(db, template=template, actor=current_user)


@router.get("/recurring", response_model=list[RecurringTaskRead])
def get_recurring(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db, allow_global=False)
    return list_recurring_tasks(db, scoped_org_id)


@router.post("/recurring", response_model=RecurringTaskRead)
def post_recurring(
    payload: RecurringTaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_recurring_task(db, organization_id=scoped_org_id, payload=payload, actor=current_user)


@router.post("/recurring/run")
def post_run_recurring(
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    generated = run_recurring_generation(db)
    return {"generated": len(generated)}


@router.post("/approvals", response_model=TaskApprovalRead)
def post_approval_request(
    payload: TaskApprovalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    task = get_task_by_id(db, payload.task_id)
    if not task or not can_view_task(current_user, task):
        raise HTTPException(status_code=404, detail="Task unavailable")
    return request_approval(db, task=task, actor=current_user, reason=payload.reason)


@router.patch("/approvals/{approval_id}", response_model=TaskApprovalRead)
def patch_approval(
    approval_id: int,
    payload: TaskApprovalAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    approval = (
        db.query(TaskApproval)
        .options(joinedload(TaskApproval.task), joinedload(TaskApproval.requester), joinedload(TaskApproval.approver))
        .filter(TaskApproval.id == approval_id)
        .first()
    )
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    resolve_org_scope(approval.task.organization_id, current_user, db, allow_global=False)
    return decide_approval(db, approval=approval, status=payload.status, actor=current_user)


@router.get("/tasks/{task_id}/messages")
def get_task_chat(
    task_id: int,
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    task = get_task_by_id(db, task_id)
    if not task or not can_view_task(current_user, task):
        raise HTTPException(status_code=404, detail="Task unavailable")
    items = list_task_messages(db, task_id)
    return paginate_list(items, page=page, page_size=page_size) if paginated else items


@router.post("/tasks/{task_id}/messages", response_model=TaskMessageRead)
def post_task_chat(
    task_id: int,
    payload: TaskMessageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    task = get_task_by_id(db, task_id)
    if not task or not can_view_task(current_user, task):
        raise HTTPException(status_code=404, detail="Task unavailable")
    return add_task_message(db, task=task, actor=current_user, message=payload.message)


@router.get("/search", response_model=list[GlobalSearchResult])
def get_search(
    q: str = Query(default=""),
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db) if organization_id or current_user.role != "SUPER_ADMIN" else None
    return global_search(db, current_user=current_user, query=q, organization_id=scoped_org_id)


@router.get("/reports/summary", response_model=ReportSummary)
def get_report_summary(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return report_summary(db, organization_id=scoped_org_id)


@router.get("/reports/tasks.csv", response_class=PlainTextResponse)
def get_report_export(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return export_tasks_csv(db, organization_id=scoped_org_id)


@router.get("/audit-logs")
def get_audit_logs(
    organization_id: int | None = Query(default=None),
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    items = list_audit_logs(db, organization_id=scoped_org_id, limit=max(limit, page_size if paginated else limit))
    return paginate_list(items, page=page, page_size=page_size) if paginated else items


@router.get("/permissions/matrix", response_model=list[PermissionMatrixEntry])
def get_permission_matrix(current_user=Depends(get_current_user)):
    return permission_matrix()
