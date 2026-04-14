from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.task import (
    TaskAIActionRequest,
    TaskAIActionResponse,
    TaskAttachmentRead,
    TaskCommentCreate,
    TaskCommentRead,
    TaskCreate,
    TaskRead,
    TaskReadLight,
    TaskStatusUpdate,
    TaskSubtaskCreate,
    TaskUpdate,
    TaskActivityRead,
    TaskWatcherRead,
)
from app.services.ai_service import task_assist
from app.services.task_service import (
    add_task_attachment,
    add_task_comment,
    build_attachment_download_response,
    can_edit_task,
    can_create_task,
    can_view_task,
    create_task,
    create_subtask,
    enrich_task,
    get_task_by_id,
    get_attachment_by_id,
    list_task_activity,
    list_task_attachments,
    list_task_comments,
    list_tasks,
    list_subtasks,
    update_task,
    update_task_status,
    unwatch_task,
    watch_task,
)
from app.utils.dependencies import get_current_user, resolve_org_scope
from app.utils.pagination import paginate_list


router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
def get_tasks(
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    assignee_id: int | None = Query(default=None),
    organization_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    sla_status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    parent_task_id: int | None = Query(default=None),
    watched_only: bool = Query(default=False),
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    items = list_tasks(
        db,
        current_user=current_user,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        organization_id=scoped_org_id,
        team_id=team_id,
        sla_status=sla_status,
        search=search,
        parent_task_id=parent_task_id,
        watched_only=watched_only,
    )
    return paginate_list(items, page=page, page_size=page_size) if paginated else items


@router.post("", response_model=TaskRead)
def create_task_endpoint(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not can_create_task(current_user):
        raise HTTPException(status_code=403, detail="You cannot create tasks")
    scoped_org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_task(db, payload, scoped_org_id, current_user)


def _load_authorized_task(db: Session, task_id: int, current_user):
    task = get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_view_task(current_user, task):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return task


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = _load_authorized_task(db, task_id, current_user)
    return enrich_task(task, db)


@router.put("/{task_id}", response_model=TaskRead)
def put_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = _load_authorized_task(db, task_id, current_user)
    if not can_edit_task(current_user, task):
        raise HTTPException(status_code=403, detail="You cannot edit this task")
    updated = update_task(db, task_id=task_id, payload=payload, actor=current_user)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated


@router.patch("/{task_id}/status", response_model=TaskRead)
def patch_task_status(task_id: int, payload: TaskStatusUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = _load_authorized_task(db, task_id, current_user)
    if not can_edit_task(current_user, task):
        raise HTTPException(status_code=403, detail="You cannot update this task status")
    updated = update_task_status(db, task_id, payload.status, current_user)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated


@router.post("/{task_id}/comments", response_model=TaskCommentRead)
@router.post("/{task_id}/comment", response_model=TaskCommentRead, include_in_schema=False)
def post_comment(task_id: int, payload: TaskCommentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _load_authorized_task(db, task_id, current_user)
    return add_task_comment(db, task_id=task_id, actor=current_user, content=payload.content)


@router.get("/{task_id}/comments", response_model=list[TaskCommentRead])
def get_comments(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _load_authorized_task(db, task_id, current_user)
    return list_task_comments(db, task_id)


@router.get("/{task_id}/activity", response_model=list[TaskActivityRead])
def get_activity(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _load_authorized_task(db, task_id, current_user)
    return list_task_activity(db, task_id)


@router.post("/{task_id}/attachments", response_model=TaskAttachmentRead)
def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    task = _load_authorized_task(db, task_id, current_user)
    if not can_edit_task(current_user, task):
        raise HTTPException(status_code=403, detail="You cannot add attachments to this task")
    return add_task_attachment(db, task=task, actor=current_user, upload=file)


@router.get("/{task_id}/attachments", response_model=list[TaskAttachmentRead])
def get_attachments(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _load_authorized_task(db, task_id, current_user)
    return list_task_attachments(db, task_id)


@router.get("/{task_id}/attachments/{attachment_id}/download")
def download_attachment(task_id: int, attachment_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _load_authorized_task(db, task_id, current_user)
    attachment = get_attachment_by_id(db, task_id=task_id, attachment_id=attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return build_attachment_download_response(attachment=attachment)


@router.post("/{task_id}/watch", response_model=TaskWatcherRead)
def post_watch(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = _load_authorized_task(db, task_id, current_user)
    return watch_task(db, task=task, actor=current_user)


@router.delete("/{task_id}/watch")
def delete_watch(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = _load_authorized_task(db, task_id, current_user)
    return {"removed": unwatch_task(db, task=task, actor=current_user)}


@router.post("/{task_id}/subtasks", response_model=TaskRead)
def post_subtask(task_id: int, payload: TaskSubtaskCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = _load_authorized_task(db, task_id, current_user)
    if not can_edit_task(current_user, task):
        raise HTTPException(status_code=403, detail="You cannot create subtasks for this task")
    return create_subtask(db, parent_task=task, actor=current_user, payload=payload)


@router.get("/{task_id}/subtasks", response_model=list[TaskReadLight])
def get_subtasks(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _load_authorized_task(db, task_id, current_user)
    return list_subtasks(db, parent_task_id=task_id)


@router.post("/{task_id}/ai-assist", response_model=TaskAIActionResponse)
def task_ai_assist(task_id: int, payload: TaskAIActionRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = _load_authorized_task(db, task_id, current_user)
    result = task_assist(task=task, user=current_user, action=payload.action)
    return {"action": payload.action, "result": result}
