from datetime import datetime, timezone

from sqlalchemy.orm import Session, aliased, joinedload

from app.core.permissions import ROLE_MANAGER, ROLE_SUPER_ADMIN, ROLE_USER
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import User
from app.models.knowledge import KnowledgeItem
from app.native.risk_score import task_risk_score
from app.services.notification_service import create_notification


PRIORITY_WEIGHTS = {"low": 1, "medium": 2, "high": 4, "critical": 5}


def compute_sla_status(task: Task) -> str:
    if not task.due_at:
        return "on_track"

    now = datetime.now(timezone.utc)
    due_at = task.due_at
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)

    if task.status == "done":
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


def enrich_task(task: Task, db: Session) -> Task:
    task.sla_status = compute_sla_status(task)
    task.risk_score = compute_task_risk(task, db)
    return task


def task_query(db: Session):
    return db.query(Task).options(
        joinedload(Task.organization),
        joinedload(Task.assignee).joinedload(User.team),
        joinedload(Task.creator).joinedload(User.team),
        joinedload(Task.related_knowledge).joinedload(KnowledgeItem.tags),
        joinedload(Task.comments),
    )


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
):
    query = task_query(db)
    assignee_user = aliased(User)
    assignee_joined = False
    if current_user.role == ROLE_SUPER_ADMIN:
        scoped_org_id = organization_id
    else:
        scoped_org_id = current_user.organization_id
    query = query.filter(Task.organization_id == scoped_org_id) if scoped_org_id else query

    if current_user.role == ROLE_MANAGER and current_user.team_id:
        query = query.join(assignee_user, Task.assignee_id == assignee_user.id, isouter=True).filter(
            (Task.assignee_id.is_(None)) | (assignee_user.team_id == current_user.team_id) | (Task.creator_id == current_user.id)
        )
        assignee_joined = True
    elif current_user.role == ROLE_USER:
        query = query.filter((Task.assignee_id == current_user.id) | (Task.creator_id == current_user.id))

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if team_id:
        if not assignee_joined:
            query = query.join(assignee_user, Task.assignee_id == assignee_user.id, isouter=True)
            assignee_joined = True
        query = query.filter(assignee_user.team_id == team_id)
    if sla_status:
        query = query.filter(Task.sla_status == sla_status)
    tasks = query.order_by(Task.updated_at.desc()).all()
    for task in tasks:
        enrich_task(task, db)
    return tasks


def create_task(db: Session, payload, organization_id: int):
    task = Task(**payload.model_dump(exclude={"organization_id"}), organization_id=organization_id)
    task.sla_status = compute_sla_status(task)
    db.add(task)
    db.commit()
    db.refresh(task)

    if task.priority in {"high", "critical"}:
        create_notification(
            db,
            title="High priority task created",
            message=f"{task.title} requires leadership visibility.",
            organization_id=task.organization_id,
            type_="task",
            severity="high",
            user_id=task.assignee_id,
            role_target="MANAGER",
        )
    return enrich_task(task, db)


def get_task_by_id(db: Session, task_id: int):
    return task_query(db).filter(Task.id == task_id).first()


def update_task_status(db: Session, task_id: int, status: str):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return None
    task.status = status
    task.sla_status = compute_sla_status(task)
    db.commit()
    db.refresh(task)
    return enrich_task(task, db)
