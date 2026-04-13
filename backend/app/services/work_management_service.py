import csv
import io
import json
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.realtime import publish_event
from app.models.knowledge import KnowledgeItem
from app.models.organization import Organization
from app.models.task import Task
from app.models.user import User
from app.models.work_management import RecurringTask, Sprint, TaskApproval, TaskMessage, TaskTemplate
from app.models.collaboration import OrganizationSetting
from app.schemas.work_management import PermissionMatrixEntry
from app.services.audit_service import log_audit_event, list_audit_logs
from app.services.task_service import create_task, enrich_task


SPRINT_STATUSES = {"PLANNED", "ACTIVE", "COMPLETED"}
APPROVAL_STATUSES = {"PENDING", "APPROVED", "REJECTED"}
RECURRING_FREQUENCIES = {"daily": 1, "weekly": 7, "monthly": 30}


def _serialize_light_task(task: Task):
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "due_at": task.due_at,
        "assignee": task.assignee,
    }


def list_sprints(db: Session, organization_id: int):
    sprints = (
        db.query(Sprint)
        .options(joinedload(Sprint.tasks).joinedload(Task.assignee))
        .filter(Sprint.organization_id == organization_id)
        .order_by(Sprint.created_at.desc())
        .all()
    )
    for sprint in sprints:
        statuses = [task.status for task in sprint.tasks]
        sprint.progress = {
            "total": len(statuses),
            "done": len([status for status in statuses if status == "DONE"]),
            "open": len([status for status in statuses if status != "DONE"]),
        }
        sprint.tasks = [_serialize_light_task(task) for task in sprint.tasks]
    return sprints


def create_sprint(db: Session, *, organization_id: int, payload, actor: User):
    sprint = Sprint(
        organization_id=organization_id,
        name=payload.name,
        goal=payload.goal,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="PLANNED",
    )
    db.add(sprint)
    db.flush()
    log_audit_event(db, organization_id=organization_id, user_id=actor.id, action="sprint_created", entity_type="Sprint", entity_id=sprint.id, details=sprint.name)
    db.commit()
    db.refresh(sprint)
    publish_event("sprint_updated", {"id": sprint.id, "name": sprint.name, "status": sprint.status, "message": f"{actor.full_name} created sprint {sprint.name}"}, organization_id=organization_id)
    return sprint


def update_sprint_status(db: Session, *, sprint: Sprint, status: str, actor: User):
    status = status.upper()
    if status not in SPRINT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid sprint status")
    sprint.status = status
    db.add(sprint)
    log_audit_event(db, organization_id=sprint.organization_id, user_id=actor.id, action="sprint_status_updated", entity_type="Sprint", entity_id=sprint.id, details=status)
    db.commit()
    db.refresh(sprint)
    publish_event("sprint_updated", {"id": sprint.id, "name": sprint.name, "status": sprint.status, "message": f"{actor.full_name} moved sprint {sprint.name} to {sprint.status}"}, organization_id=sprint.organization_id)
    return sprint


def backlog_tasks(db: Session, *, organization_id: int, current_user):
    query = db.query(Task).options(joinedload(Task.assignee)).filter(Task.organization_id == organization_id, Task.sprint_id.is_(None))
    if current_user.role == "USER":
        query = query.filter((Task.assignee_id == current_user.id) | (Task.creator_id == current_user.id))
    elif current_user.role == "MANAGER" and current_user.team_id:
        query = query.join(User, Task.assignee_id == User.id, isouter=True).filter((Task.assignee_id.is_(None)) | (User.team_id == current_user.team_id) | (Task.creator_id == current_user.id))
    return query.order_by(Task.backlog_order.asc(), Task.updated_at.desc()).all()


def assign_task_to_sprint(db: Session, *, task: Task, sprint_id: int | None, actor: User):
    old_sprint_id = task.sprint_id
    task.sprint_id = sprint_id
    db.add(task)
    log_audit_event(db, organization_id=task.organization_id, user_id=actor.id, action="task_sprint_updated", entity_type="Task", entity_id=task.id, details=f"{old_sprint_id}->{sprint_id}")
    db.commit()
    db.refresh(task)
    publish_event("backlog_updated", {"task_id": task.id, "sprint_id": sprint_id, "message": f"{actor.full_name} moved {task.title} {'to backlog' if sprint_id is None else 'into a sprint'}"}, organization_id=task.organization_id)
    return task


def reorder_backlog(db: Session, *, organization_id: int, ordered_ids: list[int], actor: User):
    tasks = db.query(Task).filter(Task.organization_id == organization_id, Task.id.in_(ordered_ids)).all()
    by_id = {task.id: task for task in tasks}
    for index, task_id in enumerate(ordered_ids, start=1):
        if task_id in by_id:
            by_id[task_id].backlog_order = index
            db.add(by_id[task_id])
    log_audit_event(db, organization_id=organization_id, user_id=actor.id, action="backlog_reordered", entity_type="Task", details=",".join(map(str, ordered_ids)))
    db.commit()
    publish_event("backlog_updated", {"ordered_ids": ordered_ids, "message": f"{actor.full_name} reordered the backlog"}, organization_id=organization_id)


def list_templates(db: Session, organization_id: int):
    return db.query(TaskTemplate).filter(TaskTemplate.organization_id == organization_id).order_by(TaskTemplate.name.asc()).all()


def create_template(db: Session, *, organization_id: int, payload, actor: User):
    template = TaskTemplate(
        organization_id=organization_id,
        name=payload.name,
        title_template=payload.title_template,
        description_template=payload.description_template,
        default_priority=payload.default_priority,
        default_tags=json.dumps(payload.default_tags),
        default_sla=payload.default_sla,
    )
    db.add(template)
    db.flush()
    log_audit_event(db, organization_id=organization_id, user_id=actor.id, action="template_created", entity_type="TaskTemplate", entity_id=template.id, details=template.name)
    db.commit()
    db.refresh(template)
    publish_event("template_updated", {"id": template.id, "name": template.name, "message": f"{actor.full_name} created task template {template.name}"}, organization_id=organization_id)
    return template


def create_task_from_template(db: Session, *, template: TaskTemplate, actor: User):
    payload = type("TemplateTaskPayload", (), {
        "title": template.title_template,
        "description": template.description_template,
        "status": "TODO",
        "priority": template.default_priority,
        "tags": json.loads(template.default_tags or "[]"),
        "related_knowledge_ids": [],
        "parent_task_id": None,
        "assignee_id": actor.id,
        "due_at": None,
        "sla_hours": template.default_sla,
        "related_knowledge_id": None,
        "sprint_id": None,
    })
    return create_task(db, payload, template.organization_id, actor)


def list_recurring_tasks(db: Session, organization_id: int):
    return (
        db.query(RecurringTask)
        .options(joinedload(RecurringTask.template))
        .filter(RecurringTask.organization_id == organization_id)
        .order_by(RecurringTask.created_at.desc())
        .all()
    )


def create_recurring_task(db: Session, *, organization_id: int, payload, actor: User):
    recurring = RecurringTask(
        organization_id=organization_id,
        template_id=payload.template_id,
        source_task_id=payload.source_task_id,
        frequency=payload.frequency,
        next_run_at=payload.next_run_at,
        is_active=payload.is_active,
    )
    db.add(recurring)
    db.flush()
    log_audit_event(db, organization_id=organization_id, user_id=actor.id, action="recurring_created", entity_type="RecurringTask", entity_id=recurring.id, details=recurring.frequency)
    db.commit()
    db.refresh(recurring)
    return recurring


def run_recurring_generation(db: Session):
    now = datetime.now(timezone.utc)
    recurring_items = db.query(RecurringTask).options(joinedload(RecurringTask.template)).filter(RecurringTask.is_active.is_(True), RecurringTask.next_run_at <= now).all()
    generated = []
    for recurring in recurring_items:
        setting = db.query(OrganizationSetting).filter(OrganizationSetting.organization_id == recurring.organization_id).first()
        if setting and not setting.recurring_auto_run:
            continue
        if recurring.template:
            system_actor = db.query(User).filter(User.organization_id == recurring.organization_id).order_by(User.id.asc()).first()
            if not system_actor:
                continue
            task = create_task_from_template(db, template=recurring.template, actor=system_actor)
            generated.append(task)
            recurring.next_run_at = recurring.next_run_at + timedelta(days=RECURRING_FREQUENCIES.get(recurring.frequency, 7))
            db.add(recurring)
            publish_event("recurring_task_created", {"task_id": task.id, "title": task.title, "message": f"Recurring task {task.title} was generated"}, organization_id=recurring.organization_id)
    db.commit()
    return generated


def request_approval(db: Session, *, task: Task, actor: User, reason: str | None = None):
    approval = TaskApproval(task_id=task.id, requested_by=actor.id, reason=reason, status="PENDING")
    db.add(approval)
    db.flush()
    log_audit_event(db, organization_id=task.organization_id, user_id=actor.id, action="approval_requested", entity_type="TaskApproval", entity_id=approval.id, details=task.title)
    db.commit()
    db.refresh(approval)
    publish_event("approval_updated", {"id": approval.id, "task_id": task.id, "status": approval.status, "message": f"{actor.full_name} requested approval for {task.title}"}, organization_id=task.organization_id)
    return approval


def decide_approval(db: Session, *, approval: TaskApproval, status: str, actor: User):
    status = status.upper()
    if status not in APPROVAL_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid approval status")
    approval.status = status
    approval.approved_by = actor.id
    db.add(approval)
    log_audit_event(db, organization_id=approval.task.organization_id, user_id=actor.id, action="approval_decided", entity_type="TaskApproval", entity_id=approval.id, details=status)
    db.commit()
    db.refresh(approval)
    publish_event("approval_updated", {"id": approval.id, "task_id": approval.task_id, "status": approval.status, "message": f"{actor.full_name} {approval.status.lower()} approval for {approval.task.title}"}, organization_id=approval.task.organization_id)
    return approval


def list_task_messages(db: Session, task_id: int):
    return (
        db.query(TaskMessage)
        .options(joinedload(TaskMessage.user).joinedload(User.team))
        .filter(TaskMessage.task_id == task_id)
        .order_by(TaskMessage.created_at.asc())
        .all()
    )


def add_task_message(db: Session, *, task: Task, actor: User, message: str):
    item = TaskMessage(task_id=task.id, user_id=actor.id, message=message)
    db.add(item)
    db.flush()
    log_audit_event(db, organization_id=task.organization_id, user_id=actor.id, action="task_message_sent", entity_type="TaskMessage", entity_id=item.id, details=task.title)
    db.commit()
    item = db.query(TaskMessage).options(joinedload(TaskMessage.user).joinedload(User.team)).filter(TaskMessage.id == item.id).first()
    publish_event("task_message_created", {"id": item.id, "task_id": task.id, "message": item.message, "user": {"id": actor.id, "full_name": actor.full_name}, "created_at": item.created_at.isoformat() if item.created_at else None}, organization_id=task.organization_id)
    return item


def global_search(db: Session, *, current_user, query: str, organization_id: int | None = None):
    query = (query or "").strip()
    if not query:
        return []
    like = f"%{query.lower()}%"
    org_scope = organization_id if current_user.role == "SUPER_ADMIN" else current_user.organization_id
    results = []
    tasks = db.query(Task).filter(Task.organization_id == org_scope if org_scope else True).filter((Task.title.ilike(like)) | (Task.description.ilike(like))).limit(6).all()
    results.extend([{"type": "task", "id": task.id, "title": task.title, "subtitle": task.status, "path": "/tasks"} for task in tasks])
    users = db.query(User).filter(User.organization_id == org_scope if org_scope else True).filter((User.full_name.ilike(like)) | (User.email.ilike(like))).limit(6).all()
    results.extend([{"type": "user", "id": user.id, "title": user.full_name, "subtitle": user.role, "path": "/employees"} for user in users])
    knowledge = db.query(KnowledgeItem).filter(KnowledgeItem.organization_id == org_scope if org_scope else True).filter((KnowledgeItem.title.ilike(like)) | (KnowledgeItem.summary.ilike(like))).limit(6).all()
    results.extend([{"type": "knowledge", "id": item.id, "title": item.title, "subtitle": item.category, "path": "/knowledge"} for item in knowledge])
    if current_user.role == "SUPER_ADMIN":
        organizations = db.query(Organization).filter((Organization.name.ilike(like)) | (Organization.slug.ilike(like))).limit(4).all()
        results.extend([{"type": "organization", "id": org.id, "title": org.name, "subtitle": org.industry, "path": "/organizations"} for org in organizations])
    return results[:16]


def report_summary(db: Session, *, organization_id: int | None = None):
    task_query = db.query(Task)
    if organization_id is not None:
        task_query = task_query.filter(Task.organization_id == organization_id)
    tasks = task_query.options(joinedload(Task.assignee)).all()
    sprints = db.query(Sprint).filter(Sprint.organization_id == organization_id if organization_id else True).options(joinedload(Sprint.tasks)).all()
    tasks_by_status = {status: len([task for task in tasks if task.status == status]) for status in ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"]}
    by_user = {}
    for task in tasks:
        label = task.assignee.full_name if task.assignee else "Unassigned"
        by_user[label] = by_user.get(label, 0) + 1
    sprint_performance = [{"id": sprint.id, "name": sprint.name, "status": sprint.status, "completed_tasks": len([task for task in sprint.tasks if task.status == "DONE"]), "total_tasks": len(sprint.tasks)} for sprint in sprints]
    overdue = [{"id": task.id, "title": task.title, "priority": task.priority, "assignee": task.assignee.full_name if task.assignee else "Unassigned"} for task in tasks if task.sla_status == "breached"][:10]
    on_time = len([task for task in tasks if task.sla_status in {"on_track", "resolved"}])
    return {
        "tasks_by_status": tasks_by_status,
        "tasks_by_user": [{"user": name, "count": count} for name, count in sorted(by_user.items(), key=lambda entry: entry[1], reverse=True)],
        "sla_performance": {"on_track_or_resolved": on_time, "warning": len([task for task in tasks if task.sla_status == "warning"]), "breached": len([task for task in tasks if task.sla_status == "breached"])},
        "overdue_tasks": overdue,
        "sprint_performance": sprint_performance,
    }


def export_tasks_csv(db: Session, *, organization_id: int | None = None):
    query = db.query(Task).options(joinedload(Task.assignee))
    if organization_id is not None:
        query = query.filter(Task.organization_id == organization_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "title", "status", "priority", "assignee", "due_at", "sla_status", "sprint_id"])
    for task in query.order_by(Task.id.asc()).all():
        writer.writerow([task.id, task.title, task.status, task.priority, task.assignee.full_name if task.assignee else "", task.due_at.isoformat() if task.due_at else "", task.sla_status, task.sprint_id or ""])
    return output.getvalue()


def permission_matrix():
    return [
        PermissionMatrixEntry(capability="Create org", super_admin=True, admin=False, manager=False, user=False),
        PermissionMatrixEntry(capability="Manage users", super_admin=True, admin=True, manager=True, user=False),
        PermissionMatrixEntry(capability="Edit tasks", super_admin=True, admin=True, manager=True, user=True),
        PermissionMatrixEntry(capability="Cross-org access", super_admin=True, admin=False, manager=False, user=False),
        PermissionMatrixEntry(capability="Manage sprints", super_admin=True, admin=True, manager=True, user=False),
        PermissionMatrixEntry(capability="Approve tasks", super_admin=True, admin=True, manager=True, user=False),
        PermissionMatrixEntry(capability="View audit logs", super_admin=True, admin=True, manager=False, user=False),
    ]
