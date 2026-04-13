import os
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session, aliased, joinedload

from app.core.config import get_settings
from app.core.realtime import publish_event
from app.core.permissions import ROLE_MANAGER, ROLE_SUPER_ADMIN, ROLE_USER
from app.models.knowledge import KnowledgeItem
from app.models.notification import Notification
from app.models.task import Task, TaskActivity, TaskAttachment, TaskComment, TaskWatcher
from app.models.user import User
from app.models.work_management import TaskApproval, TaskMessage
from app.native.risk_score import task_risk_score
from app.services.notification_service import create_notification
from app.services.audit_service import log_audit_event


PRIORITY_WEIGHTS = {"low": 1, "medium": 2, "high": 4, "critical": 5}
ALLOWED_STATUSES = {"TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"}
ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}
STATUS_NORMALIZATION = {
    "todo": "TODO",
    "in_progress": "IN_PROGRESS",
    "blocked": "BLOCKED",
    "review": "REVIEW",
    "done": "DONE",
}
VALID_STATUS_TRANSITIONS = {
    "TODO": {"IN_PROGRESS", "BLOCKED", "DONE"},
    "IN_PROGRESS": {"BLOCKED", "REVIEW", "DONE", "TODO"},
    "BLOCKED": {"IN_PROGRESS", "TODO", "DONE"},
    "REVIEW": {"IN_PROGRESS", "DONE", "BLOCKED"},
    "DONE": {"REVIEW"},
}
MENTION_PATTERN = re.compile(r"@([A-Za-z0-9._-]+)")


def normalize_status(value: str) -> str:
    normalized = STATUS_NORMALIZATION.get((value or "").lower(), value)
    if normalized not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid task status")
    return normalized


def normalize_priority(value: str) -> str:
    normalized = (value or "").lower()
    if normalized not in ALLOWED_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid task priority")
    return normalized


def compute_sla_status(task: Task) -> str:
    if not task.due_at:
        return "on_track"

    now = datetime.now(timezone.utc)
    due_at = task.due_at
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)

    if task.status == "DONE":
        return "resolved"
    if due_at < now:
        return "breached"
    if (due_at - now).total_seconds() <= 3600 * 12:
        return "warning"
    return "on_track"


def compute_task_risk(task: Task, db: Session) -> int:
    due_at = task.due_at
    now = datetime.now(timezone.utc)
    if due_at and due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)
    hours_overdue = int(max((now - due_at).total_seconds(), 0) // 3600) if due_at else 0
    unread_notifications = (
        db.query(Notification)
        .filter(Notification.user_id == task.assignee_id, Notification.is_read.is_(False))
        .count()
        if task.assignee_id
        else 0
    )
    return task_risk_score(
        hours_overdue,
        PRIORITY_WEIGHTS.get(task.priority, 2),
        unread_notifications,
        task.sla_status == "breached",
    )


def _sort_task_collections(task: Task):
    task.comments = sorted(task.comments, key=lambda item: item.created_at, reverse=True)
    task.activities = sorted(task.activities, key=lambda item: item.created_at, reverse=True)
    task.attachments = sorted(task.attachments, key=lambda item: item.created_at, reverse=True)
    task.watchers = sorted(task.watchers, key=lambda item: item.created_at, reverse=True)
    task.subtasks = sorted(task.subtasks, key=lambda item: item.created_at, reverse=True)
    return task


def _attach_related_knowledge_items(task: Task, db: Session):
    knowledge_ids = list(dict.fromkeys(([task.related_knowledge_id] if task.related_knowledge_id else []) + task.related_knowledge_ids))
    if not knowledge_ids:
        task.related_knowledge_items = []
        return task
    task.related_knowledge_items = (
        db.query(KnowledgeItem)
        .options(joinedload(KnowledgeItem.tags), joinedload(KnowledgeItem.author).joinedload(User.team))
        .filter(KnowledgeItem.id.in_(knowledge_ids))
        .all()
    )
    return task


def enrich_task(task: Task, db: Session) -> Task:
    if not task:
        return task
    task.sla_status = compute_sla_status(task)
    task.risk_score = compute_task_risk(task, db)
    subtask_statuses = [subtask.status for subtask in task.subtasks]
    task.subtask_progress = {"total": len(subtask_statuses), "done": len([status for status in subtask_statuses if status == "DONE"]), "open": len([status for status in subtask_statuses if status != "DONE"])}
    _attach_related_knowledge_items(task, db)
    return _sort_task_collections(task)


def task_query(db: Session):
    return db.query(Task).options(
        joinedload(Task.organization),
        joinedload(Task.assignee).joinedload(User.team),
        joinedload(Task.creator).joinedload(User.team),
        joinedload(Task.related_knowledge).joinedload(KnowledgeItem.tags),
        joinedload(Task.comments).joinedload(TaskComment.author).joinedload(User.team),
        joinedload(Task.activities).joinedload(TaskActivity.user).joinedload(User.team),
        joinedload(Task.attachments).joinedload(TaskAttachment.uploader).joinedload(User.team),
        joinedload(Task.watchers).joinedload(TaskWatcher.user).joinedload(User.team),
        joinedload(Task.subtasks).joinedload(Task.assignee).joinedload(User.team),
        joinedload(Task.approvals).joinedload(TaskApproval.requester),
        joinedload(Task.approvals).joinedload(TaskApproval.approver),
        joinedload(Task.messages).joinedload(TaskMessage.user),
    )


def can_view_task(current_user: User, task: Task) -> bool:
    if current_user.role == ROLE_SUPER_ADMIN:
        return True
    if task.organization_id != current_user.organization_id:
        return False
    if current_user.role == ROLE_MANAGER:
        return task.assignee is None or task.assignee_id == current_user.id or task.creator_id == current_user.id or task.assignee.team_id == current_user.team_id
    if current_user.role == ROLE_USER:
        return task.assignee_id == current_user.id or task.creator_id == current_user.id
    return True


def can_edit_task(current_user: User, task: Task) -> bool:
    if current_user.role == ROLE_SUPER_ADMIN:
        return True
    if task.organization_id != current_user.organization_id:
        return False
    if current_user.role == "ADMIN":
        return True
    if current_user.role == ROLE_MANAGER:
        return task.assignee is None or task.creator_id == current_user.id or (task.assignee and task.assignee.team_id == current_user.team_id)
    if current_user.role == ROLE_USER:
        return task.assignee_id == current_user.id or task.creator_id == current_user.id
    return False


def can_reassign_task(current_user: User, task: Task) -> bool:
    return current_user.role in {ROLE_SUPER_ADMIN, "ADMIN", ROLE_MANAGER} and can_edit_task(current_user, task)


def can_create_task(current_user: User) -> bool:
    return current_user.role in {ROLE_SUPER_ADMIN, "ADMIN", ROLE_MANAGER, ROLE_USER}


def log_task_activity(
    db: Session,
    *,
    task_id: int,
    user_id: int | None,
    action_type: str,
    message: str,
    field_changed: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
):
    activity = TaskActivity(
        task_id=task_id,
        user_id=user_id,
        action_type=action_type,
        message=message,
        field_changed=field_changed,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(activity)
    db.flush()
    return activity


def notify_task_event(
    db: Session,
    *,
    task: Task,
    actor: User,
    title: str,
    message: str,
    severity: str = "medium",
    type_: str = "task",
    user_id: int | None = None,
    role_target: str | None = None,
    is_org_wide: bool = False,
):
    return create_notification(
        db,
        title=title,
        message=f"{task.title}: {message} by {actor.full_name}.",
        organization_id=task.organization_id,
        type_=type_,
        severity=severity,
        user_id=user_id,
        role_target=role_target,
        is_org_wide=is_org_wide,
    )


def serialize_user(user: User | None):
    if not user:
        return None
    return {"id": user.id, "full_name": user.full_name, "role": user.role, "team": user.team.name if user.team else None}


def serialize_task_snapshot(task: Task):
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "assignee": serialize_user(task.assignee),
        "creator": serialize_user(task.creator),
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "sla_status": task.sla_status,
        "risk_score": getattr(task, "risk_score", 0),
        "parent_task_id": task.parent_task_id,
        "external_refs": list(task.external_refs),
        "tags": list(task.tags),
        "subtask_progress": getattr(task, "subtask_progress", {"total": 0, "done": 0, "open": 0}),
    }


def serialize_comment_snapshot(comment: TaskComment):
    return {"id": comment.id, "task_id": comment.task_id, "content": comment.content, "created_at": comment.created_at.isoformat() if comment.created_at else None, "author": serialize_user(comment.author)}


def serialize_attachment_snapshot(attachment: TaskAttachment):
    return {"id": attachment.id, "task_id": attachment.task_id, "file_name": attachment.file_name, "file_path": attachment.file_path, "created_at": attachment.created_at.isoformat() if attachment.created_at else None, "uploader": serialize_user(attachment.uploader)}


def _publish_task_event(event_type: str, task: Task, data: dict | None = None, *, user_id: int | None = None):
    publish_event(event_type, {"task": serialize_task_snapshot(task), **(data or {})}, organization_id=task.organization_id, user_id=user_id)


def _watcher_user_ids(task: Task):
    return [watcher.user_id for watcher in task.watchers if watcher.user_id]


def _notify_task_watchers(db: Session, *, task: Task, actor: User, title: str, message: str, exclude_user_ids: set[int] | None = None):
    exclude_user_ids = exclude_user_ids or set()
    for watcher_user_id in _watcher_user_ids(task):
        if watcher_user_id in exclude_user_ids:
            continue
        notify_task_event(db, task=task, actor=actor, title=title, message=message, user_id=watcher_user_id)


def _parse_mentions(content: str):
    return {match.lower() for match in MENTION_PATTERN.findall(content or "")}


def _resolve_mentions(db: Session, *, task: Task, content: str):
    handles = _parse_mentions(content)
    if not handles:
        return []
    users = db.query(User).filter(User.organization_id == task.organization_id).all()
    matched = []
    for user in users:
        username = user.email.split("@", 1)[0].lower()
        name_tokens = {token.lower() for token in user.full_name.replace(".", " ").split()}
        if username in handles or handles.intersection(name_tokens):
            matched.append(user)
    return matched


def list_tasks(
    db: Session,
    *,
    current_user,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    organization_id: int | None = None,
    team_id: int | None = None,
    sla_status: str | None = None,
    search: str | None = None,
    parent_task_id: int | None = None,
    watched_only: bool = False,
):
    query = task_query(db)
    assignee_user = aliased(User)
    assignee_joined = False
    scoped_org_id = organization_id if current_user.role == ROLE_SUPER_ADMIN else current_user.organization_id
    if scoped_org_id:
        query = query.filter(Task.organization_id == scoped_org_id)

    if current_user.role == ROLE_MANAGER and current_user.team_id:
        query = query.join(assignee_user, Task.assignee_id == assignee_user.id, isouter=True).filter(
            (Task.assignee_id.is_(None)) | (assignee_user.team_id == current_user.team_id) | (Task.creator_id == current_user.id)
        )
        assignee_joined = True
    elif current_user.role == ROLE_USER:
        query = query.filter((Task.assignee_id == current_user.id) | (Task.creator_id == current_user.id))

    if status:
        query = query.filter(Task.status == normalize_status(status))
    if priority:
        query = query.filter(Task.priority == normalize_priority(priority))
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if team_id:
        if not assignee_joined:
            query = query.join(assignee_user, Task.assignee_id == assignee_user.id, isouter=True)
        query = query.filter(assignee_user.team_id == team_id)
    if sla_status:
        query = query.filter(Task.sla_status == sla_status)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter((Task.title.ilike(like)) | (Task.description.ilike(like)))
    if parent_task_id is not None:
        query = query.filter(Task.parent_task_id == parent_task_id)
    if watched_only:
        query = query.join(TaskWatcher, TaskWatcher.task_id == Task.id).filter(TaskWatcher.user_id == current_user.id)
    tasks = query.order_by(Task.updated_at.desc()).all()
    for task in tasks:
        enrich_task(task, db)
    return tasks


def create_task(db: Session, payload, organization_id: int, actor: User):
    if payload.assignee_id:
        assignee = db.query(User).filter(User.id == payload.assignee_id).first()
        if not assignee or assignee.organization_id != organization_id:
            raise HTTPException(status_code=400, detail="Assignee must belong to the same organization")
    if payload.parent_task_id:
        parent_task = db.query(Task).filter(Task.id == payload.parent_task_id).first()
        if not parent_task or parent_task.organization_id != organization_id:
            raise HTTPException(status_code=400, detail="Parent task must belong to the same organization")
    task = Task(
        title=payload.title,
        description=payload.description,
        organization_id=organization_id,
        status=normalize_status(payload.status),
        priority=normalize_priority(payload.priority),
        tags=payload.tags,
        related_knowledge_ids=payload.related_knowledge_ids,
        external_refs=getattr(payload, "external_refs", []),
        parent_task_id=payload.parent_task_id,
        sprint_id=getattr(payload, "sprint_id", None),
        assignee_id=payload.assignee_id,
        creator_id=actor.id,
        due_at=payload.due_at,
        sla_hours=payload.sla_hours,
        related_knowledge_id=payload.related_knowledge_id,
    )
    task.sla_status = compute_sla_status(task)
    db.add(task)
    db.flush()
    db.add(TaskWatcher(task_id=task.id, user_id=actor.id))
    if task.assignee_id and task.assignee_id != actor.id:
        db.add(TaskWatcher(task_id=task.id, user_id=task.assignee_id))
    log_task_activity(
        db,
        task_id=task.id,
        user_id=actor.id,
        action_type="created",
        message=f"{actor.full_name} created the task",
    )
    log_audit_event(db, organization_id=organization_id, user_id=actor.id, action="task_created", entity_type="Task", entity_id=task.id, details=task.title)
    db.commit()
    db.refresh(task)
    task = enrich_task(get_task_by_id(db, task.id), db)

    if task.assignee_id:
        notify_task_event(
            db,
            task=task,
            actor=actor,
            title="Task assigned",
            message="was assigned",
            severity="high" if task.priority in {"high", "critical"} else "medium",
            user_id=task.assignee_id,
        )
    _publish_task_event("task_created", task, {"message": f"{actor.full_name} created {task.title}"})
    return task


def get_task_by_id(db: Session, task_id: int):
    task = task_query(db).filter(Task.id == task_id).first()
    return task


def get_editable_task(db: Session, task_id: int):
    return db.query(Task).filter(Task.id == task_id).first()


def validate_status_transition(current_status: str, next_status: str):
    normalized_current = normalize_status(current_status)
    normalized_next = normalize_status(next_status)
    if normalized_current == normalized_next:
        return normalized_next
    allowed = VALID_STATUS_TRANSITIONS.get(normalized_current, set())
    if normalized_next not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status transition from {normalized_current} to {normalized_next}")
    return normalized_next


def update_task(db: Session, *, task_id: int, payload, actor: User):
    task = get_editable_task(db, task_id)
    if not task:
        return None
    previous_values = {
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assignee_id": task.assignee_id,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "sla_hours": str(task.sla_hours),
        "related_knowledge_id": str(task.related_knowledge_id) if task.related_knowledge_id else None,
        "related_knowledge_ids": ", ".join(str(item) for item in task.related_knowledge_ids),
        "external_refs": ", ".join(task.external_refs),
        "tags": ", ".join(task.tags),
        "parent_task_id": str(task.parent_task_id) if task.parent_task_id else None,
    }

    next_status = validate_status_transition(task.status, payload.status)
    task.title = payload.title
    task.description = payload.description
    task.status = next_status
    task.priority = normalize_priority(payload.priority)
    task.tags = payload.tags
    task.related_knowledge_ids = payload.related_knowledge_ids
    task.external_refs = getattr(payload, "external_refs", [])
    if payload.assignee_id != task.assignee_id and not can_reassign_task(actor, get_task_by_id(db, task.id)):
        raise HTTPException(status_code=403, detail="You do not have permission to reassign this task")
    task.assignee_id = payload.assignee_id
    task.due_at = payload.due_at
    task.sla_hours = payload.sla_hours
    task.related_knowledge_id = payload.related_knowledge_id
    task.parent_task_id = payload.parent_task_id
    task.sprint_id = payload.sprint_id
    task.sla_status = compute_sla_status(task)

    change_map = {
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "sla_hours": str(task.sla_hours),
        "related_knowledge_id": str(task.related_knowledge_id) if task.related_knowledge_id else None,
        "related_knowledge_ids": ", ".join(str(item) for item in task.related_knowledge_ids),
        "external_refs": ", ".join(task.external_refs),
        "tags": ", ".join(task.tags),
        "parent_task_id": str(task.parent_task_id) if task.parent_task_id else None,
        "sprint_id": str(task.sprint_id) if task.sprint_id else None,
    }

    for field_name, new_value in change_map.items():
        if previous_values[field_name] != new_value:
            action_type = "updated"
            message = f"{actor.full_name} updated {field_name.replace('_', ' ')}"
            if field_name == "status":
                action_type = "status_changed"
                message = f"{actor.full_name} changed status to {task.status}"
            elif field_name == "assignee_id":
                action_type = "assigned"
                message = f"{actor.full_name} reassigned the task"
            log_task_activity(
                db,
                task_id=task.id,
                user_id=actor.id,
                action_type=action_type,
                field_changed=field_name,
                old_value=previous_values[field_name],
                new_value=new_value,
                message=message,
            )
    log_audit_event(db, organization_id=task.organization_id, user_id=actor.id, action="task_updated", entity_type="Task", entity_id=task.id, details=task.title)

    db.commit()
    db.refresh(task)
    full_task = enrich_task(get_task_by_id(db, task.id), db)

    if previous_values["assignee_id"] != change_map["assignee_id"] and task.assignee_id:
        notify_task_event(db, task=task, actor=actor, title="Task reassigned", message="was reassigned", user_id=task.assignee_id)
    if previous_values["status"] != change_map["status"]:
        notify_task_event(db, task=task, actor=actor, title="Task status updated", message=f"status is now {task.status}", user_id=task.assignee_id, role_target="MANAGER")
    if any(previous_values[field] != change_map[field] for field in {"title", "description", "priority", "due_at", "sla_hours", "related_knowledge_id", "related_knowledge_ids", "external_refs", "tags"}):
        notify_task_event(db, task=task, actor=actor, title="Task updated", message="details were updated", user_id=task.assignee_id)
    _notify_task_watchers(db, task=full_task, actor=actor, title="Task updated", message="was updated", exclude_user_ids={actor.id, task.assignee_id or 0})
    _publish_task_event("task_updated", full_task, {"message": f"{actor.full_name} updated {task.title}"})
    return full_task


def update_task_status(db: Session, task_id: int, status: str, actor: User):
    task = get_editable_task(db, task_id)
    if not task:
        return None
    old_status = task.status
    task.status = validate_status_transition(task.status, status)
    task.sla_status = compute_sla_status(task)
    log_task_activity(
        db,
        task_id=task.id,
        user_id=actor.id,
        action_type="status_changed",
        field_changed="status",
        old_value=old_status,
        new_value=task.status,
        message=f"{actor.full_name} changed status to {task.status}",
    )
    log_audit_event(db, organization_id=task.organization_id, user_id=actor.id, action="task_status_updated", entity_type="Task", entity_id=task.id, details=task.status)
    db.commit()
    db.refresh(task)
    notify_task_event(db, task=task, actor=actor, title="Task status updated", message=f"status is now {task.status}", user_id=task.assignee_id, role_target="MANAGER")
    task = enrich_task(get_task_by_id(db, task.id), db)
    _notify_task_watchers(db, task=task, actor=actor, title="Task status updated", message=f"moved to {task.status}", exclude_user_ids={actor.id, task.assignee_id or 0})
    _publish_task_event("task_status_changed", task, {"message": f"{actor.full_name} moved {task.title} to {task.status}"})
    return task


def add_task_comment(db: Session, *, task_id: int, actor: User, content: str):
    comment = TaskComment(task_id=task_id, author_id=actor.id, content=content)
    db.add(comment)
    db.flush()
    log_task_activity(
        db,
        task_id=task_id,
        user_id=actor.id,
        action_type="comment_added",
        message=f"{actor.full_name} added a comment",
    )
    task = get_task_by_id(db, task_id)
    if task:
        log_audit_event(db, organization_id=task.organization_id, user_id=actor.id, action="task_comment_added", entity_type="Task", entity_id=task.id, details=task.title)
    db.commit()
    db.refresh(comment)
    task = get_task_by_id(db, task_id)
    if task:
        notify_task_event(db, task=task, actor=actor, title="Task comment added", message="received a new comment", user_id=task.assignee_id, role_target="MANAGER")
        comment = db.query(TaskComment).options(joinedload(TaskComment.author).joinedload(User.team)).filter(TaskComment.id == comment.id).first()
        task = enrich_task(task, db)
        _notify_task_watchers(db, task=task, actor=actor, title="Task comment added", message="received a new comment", exclude_user_ids={actor.id, task.assignee_id or 0})
        for mentioned_user in _resolve_mentions(db, task=task, content=content):
            if mentioned_user.id == actor.id:
                continue
            create_notification(db, title="Mentioned in task comment", message=f"{actor.full_name} mentioned you in {task.title}.", organization_id=task.organization_id, type_="mention", severity="medium", user_id=mentioned_user.id)
            publish_event("task_mentioned", {"task": serialize_task_snapshot(task), "comment": serialize_comment_snapshot(comment), "message": f"{actor.full_name} mentioned you in {task.title}"}, organization_id=task.organization_id, user_id=mentioned_user.id)
        _publish_task_event("task_commented", task, {"message": f"{actor.full_name} commented on {task.title}", "comment": serialize_comment_snapshot(comment)})
    return comment


def list_task_comments(db: Session, task_id: int):
    return (
        db.query(TaskComment)
        .options(joinedload(TaskComment.author).joinedload(User.team))
        .filter(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.desc())
        .all()
    )


def list_task_activity(db: Session, task_id: int):
    return (
        db.query(TaskActivity)
        .options(joinedload(TaskActivity.user).joinedload(User.team))
        .filter(TaskActivity.task_id == task_id)
        .order_by(TaskActivity.created_at.desc())
        .all()
    )


def list_task_attachments(db: Session, task_id: int):
    return (
        db.query(TaskAttachment)
        .options(joinedload(TaskAttachment.uploader).joinedload(User.team))
        .filter(TaskAttachment.task_id == task_id)
        .order_by(TaskAttachment.created_at.desc())
        .all()
    )


def add_task_attachment(db: Session, *, task: Task, actor: User, upload: UploadFile):
    settings = get_settings()
    uploads_root = Path(settings.uploads_dir)
    task_dir = uploads_root / f"task_{task.id}"
    task_dir.mkdir(parents=True, exist_ok=True)

    safe_name = upload.filename or "attachment.bin"
    extension = Path(safe_name).suffix
    stored_name = f"{uuid4().hex}{extension}"
    stored_path = task_dir / stored_name

    with stored_path.open("wb") as destination:
        destination.write(upload.file.read())

    public_path = f"/uploads/task_{task.id}/{stored_name}"
    attachment = TaskAttachment(
        task_id=task.id,
        file_name=safe_name,
        file_path=public_path,
        uploaded_by=actor.id,
    )
    db.add(attachment)
    db.flush()
    log_task_activity(
        db,
        task_id=task.id,
        user_id=actor.id,
        action_type="attachment_added",
        message=f"{actor.full_name} uploaded {safe_name}",
    )
    log_audit_event(db, organization_id=task.organization_id, user_id=actor.id, action="task_attachment_added", entity_type="Task", entity_id=task.id, details=safe_name)
    db.commit()
    db.refresh(attachment)
    notify_task_event(db, task=task, actor=actor, title="Task attachment added", message=f"received attachment {safe_name}", user_id=task.assignee_id)
    attachment = db.query(TaskAttachment).options(joinedload(TaskAttachment.uploader).joinedload(User.team)).filter(TaskAttachment.id == attachment.id).first()
    enriched_task = enrich_task(get_task_by_id(db, task.id), db)
    _notify_task_watchers(db, task=enriched_task, actor=actor, title="Task attachment added", message=f"received attachment {safe_name}", exclude_user_ids={actor.id, task.assignee_id or 0})
    _publish_task_event("task_updated", enriched_task, {"message": f"{actor.full_name} uploaded {safe_name}", "attachment": serialize_attachment_snapshot(attachment)})
    return attachment


def watch_task(db: Session, *, task: Task, actor: User):
    existing = db.query(TaskWatcher).filter(TaskWatcher.task_id == task.id, TaskWatcher.user_id == actor.id).first()
    if existing:
        return existing
    watcher = TaskWatcher(task_id=task.id, user_id=actor.id)
    db.add(watcher)
    log_task_activity(db, task_id=task.id, user_id=actor.id, action_type="watch_added", message=f"{actor.full_name} is now watching the task")
    db.commit()
    watcher = db.query(TaskWatcher).options(joinedload(TaskWatcher.user).joinedload(User.team)).filter(TaskWatcher.task_id == task.id, TaskWatcher.user_id == actor.id).first()
    enriched_task = enrich_task(get_task_by_id(db, task.id), db)
    _publish_task_event("task_updated", enriched_task, {"message": f"{actor.full_name} is now watching {task.title}"})
    return watcher


def unwatch_task(db: Session, *, task: Task, actor: User):
    existing = db.query(TaskWatcher).filter(TaskWatcher.task_id == task.id, TaskWatcher.user_id == actor.id).first()
    if not existing:
        return False
    db.delete(existing)
    log_task_activity(db, task_id=task.id, user_id=actor.id, action_type="watch_removed", message=f"{actor.full_name} stopped watching the task")
    db.commit()
    enriched_task = enrich_task(get_task_by_id(db, task.id), db)
    _publish_task_event("task_updated", enriched_task, {"message": f"{actor.full_name} stopped watching {task.title}"})
    return True


def create_subtask(db: Session, *, parent_task: Task, actor: User, payload):
    subtask_payload = type("SubtaskPayload", (), {"title": payload.title, "description": payload.description, "status": "TODO", "priority": payload.priority, "tags": payload.tags, "related_knowledge_ids": [], "assignee_id": payload.assignee_id, "due_at": payload.due_at, "sla_hours": payload.sla_hours, "related_knowledge_id": parent_task.related_knowledge_id, "parent_task_id": parent_task.id})
    task = create_task(db, subtask_payload, parent_task.organization_id, actor)
    publish_event("task_updated", {"task": serialize_task_snapshot(parent_task), "message": f"{actor.full_name} created a subtask under {parent_task.title}"}, organization_id=parent_task.organization_id)
    return task


def list_subtasks(db: Session, *, parent_task_id: int):
    subtasks = task_query(db).filter(Task.parent_task_id == parent_task_id).order_by(Task.created_at.asc()).all()
    for task in subtasks:
        enrich_task(task, db)
    return subtasks
