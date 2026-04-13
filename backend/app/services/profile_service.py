from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.productivity import MeetingSummary
from app.models.task import Task, TaskActivity, TaskComment, TaskWatcher
from app.models.user import User


def _profile_completion_percent(user: User) -> int:
    checks = [
        bool(user.full_name.strip()),
        bool(user.title.strip()),
        bool(user.responsibilities.strip()),
        bool(user.team_id),
        bool(user.email.strip()),
    ]
    return int((sum(checks) / len(checks)) * 100)


def get_user_profile_payload(db: Session, *, target_user: User):
    assigned_tasks = (
        db.query(Task)
        .filter(Task.organization_id == target_user.organization_id, Task.assignee_id == target_user.id)
        .order_by(Task.updated_at.desc())
        .limit(6)
        .all()
    )
    watched_tasks = (
        db.query(Task)
        .join(TaskWatcher, TaskWatcher.task_id == Task.id)
        .filter(Task.organization_id == target_user.organization_id, TaskWatcher.user_id == target_user.id)
        .order_by(Task.updated_at.desc())
        .limit(5)
        .all()
    )
    notifications = (
        db.query(Notification)
        .filter(Notification.organization_id == target_user.organization_id)
        .filter((Notification.user_id == target_user.id) | (Notification.is_org_wide.is_(True)) | (Notification.role_target == target_user.role))
        .order_by(Notification.created_at.desc())
        .limit(6)
        .all()
    )
    approvals = [
        {"id": task.id, "title": task.title, "status": task.status}
        for task in assigned_tasks
        if task.status in {"REVIEW", "BLOCKED"}
    ]
    recent_activity = (
        db.query(TaskActivity)
        .join(Task, Task.id == TaskActivity.task_id)
        .filter(Task.organization_id == target_user.organization_id, ((Task.assignee_id == target_user.id) | (Task.creator_id == target_user.id) | (TaskActivity.user_id == target_user.id)))
        .order_by(TaskActivity.created_at.desc())
        .limit(8)
        .all()
    )
    recent_comments = (
        db.query(TaskComment)
        .join(Task, Task.id == TaskComment.task_id)
        .filter(Task.organization_id == target_user.organization_id, TaskComment.author_id == target_user.id)
        .order_by(TaskComment.created_at.desc())
        .limit(5)
        .all()
    )
    meetings = (
        db.query(MeetingSummary)
        .filter(MeetingSummary.organization_id == target_user.organization_id, MeetingSummary.created_by == target_user.id)
        .order_by(MeetingSummary.created_at.desc())
        .limit(4)
        .all()
    )
    return {
        "user": target_user,
        "profile_completion_percent": _profile_completion_percent(target_user),
        "activity_summary": {
            "assigned_tasks": len(assigned_tasks),
            "overdue_tasks": len([item for item in assigned_tasks if item.sla_status == "breached"]),
            "watched_tasks": len(watched_tasks),
            "unread_notifications": len([item for item in notifications if not item.is_read]),
        },
        "assigned_tasks": [{"id": item.id, "title": item.title, "status": item.status, "priority": item.priority, "due_at": item.due_at} for item in assigned_tasks],
        "watched_tasks": [{"id": item.id, "title": item.title, "status": item.status, "priority": item.priority, "due_at": item.due_at} for item in watched_tasks],
        "recent_notifications": [{"id": item.id, "title": item.title, "type": item.type, "severity": item.severity, "is_read": item.is_read} for item in notifications],
        "approvals": approvals,
        "recent_activity": [{"id": item.id, "label": item.message, "type": item.action_type, "created_at": item.created_at, "task_id": item.task_id} for item in recent_activity],
        "recent_comments": [{"id": item.id, "content": item.content, "task_id": item.task_id, "created_at": item.created_at} for item in recent_comments],
        "recent_meetings": [{"id": item.id, "title": item.title, "summary": item.summary, "created_at": item.created_at} for item in meetings],
        "links": [
            {"label": "Open task workspace", "path": "/tasks"},
            {"label": "Open contacts", "path": "/contacts"},
            {"label": "Open notifications", "path": "/notifications"},
        ],
    }
