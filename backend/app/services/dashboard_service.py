from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_MANAGER, ROLE_SUPER_ADMIN, ROLE_USER
from app.models.automation import AutomationRule
from app.models.knowledge import KnowledgeItem
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.task import Task
from app.models.user import User
from app.services.automation_service import get_recent_automation_events
from app.services.task_service import list_tasks


def _notification_feed(db: Session, current_user, org_id: int | None):
    query = db.query(Notification)
    if org_id is not None:
        query = query.filter(Notification.organization_id == org_id)
    if current_user.role == ROLE_USER:
        query = query.filter(
            (Notification.user_id == current_user.id)
            | (Notification.is_org_wide.is_(True))
            | (Notification.role_target == current_user.role)
        )
    return query.order_by(Notification.created_at.desc()).limit(6).all()


def get_dashboard_summary(db: Session, current_user, organization_id: int | None = None):
    scoped_org_id = organization_id if current_user.role == ROLE_SUPER_ADMIN and organization_id else current_user.organization_id
    tasks = list_tasks(db, current_user=current_user, organization_id=scoped_org_id)
    recent_notifications = _notification_feed(db, current_user, scoped_org_id)
    recent_automation_events = get_recent_automation_events(db)
    if scoped_org_id is not None:
        recent_automation_events = [event for event in recent_automation_events if event.get("organization_id", scoped_org_id) == scoped_org_id]
    recent_automation_events = recent_automation_events[:5]

    if current_user.role == ROLE_SUPER_ADMIN and organization_id is None:
        scope_label = "Global control center"
        user_count = db.query(func.count(User.id)).scalar() or 0
        knowledge_count = db.query(func.count(KnowledgeItem.id)).scalar() or 0
        task_count = db.query(func.count(Task.id)).scalar() or 0
        unread = db.query(func.count(Notification.id)).filter(Notification.is_read.is_(False)).scalar() or 0
        active_automations = db.query(func.count(AutomationRule.id)).filter(AutomationRule.is_enabled.is_(True)).scalar() or 0
    else:
        organization = db.query(Organization).filter(Organization.id == scoped_org_id).first()
        scope_label = f"{organization.name} workspace" if organization else "Scoped workspace"
        user_count = db.query(func.count(User.id)).filter(User.organization_id == scoped_org_id).scalar() or 0
        knowledge_count = db.query(func.count(KnowledgeItem.id)).filter(KnowledgeItem.organization_id == scoped_org_id).scalar() or 0
        task_count = db.query(func.count(Task.id)).filter(Task.organization_id == scoped_org_id).scalar() or 0
        unread = db.query(func.count(Notification.id)).filter(Notification.organization_id == scoped_org_id, Notification.is_read.is_(False)).scalar() or 0
        active_automations = db.query(func.count(AutomationRule.id)).filter(AutomationRule.organization_id == scoped_org_id, AutomationRule.is_enabled.is_(True)).scalar() or 0

    return {
        "scope_label": scope_label,
        "role": current_user.role,
        "total_users": user_count,
        "total_knowledge_items": knowledge_count,
        "total_tasks": task_count,
        "open_tasks": len([task for task in tasks if task.status != "DONE"]),
        "overdue_tasks": len([task for task in tasks if task.sla_status == "breached"]),
        "sla_warning_tasks": len([task for task in tasks if task.sla_status == "warning"]),
        "unread_notifications": unread,
        "active_automation_rules": active_automations,
        "recent_automation_events": recent_automation_events,
        "recent_notifications": [
            {
                "id": notification.id,
                "title": notification.title,
                "severity": notification.severity,
                "type": notification.type,
                "created_at": notification.created_at,
            }
            for notification in recent_notifications
        ],
        "task_breakdown": {
            "TODO": len([task for task in tasks if task.status == "TODO"]),
            "IN_PROGRESS": len([task for task in tasks if task.status == "IN_PROGRESS"]),
            "BLOCKED": len([task for task in tasks if task.status == "BLOCKED"]),
            "REVIEW": len([task for task in tasks if task.status == "REVIEW"]),
            "DONE": len([task for task in tasks if task.status == "DONE"]),
        },
        "focus_items": [
            {
                "title": task.title,
                "subtitle": task.description[:120],
                "priority": task.priority,
                "sla_status": task.sla_status,
                "risk_score": getattr(task, "risk_score", 0),
            }
            for task in tasks[:5]
        ],
    }
