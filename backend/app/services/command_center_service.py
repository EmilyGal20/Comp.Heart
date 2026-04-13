from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.automation import AutomationRule
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.productivity import Announcement
from app.models.task import Task, TaskActivity
from app.models.user import User
from app.models.work_management import AuditLog, TaskApproval
from app.services.analytics_service import team_risk_summary
from app.services.organization_service import organization_overview


def get_command_center_payload(db: Session):
    comparison = organization_overview(db)
    critical_notifications = (
        db.query(Notification)
        .filter(Notification.severity.in_(["high", "critical"]))
        .order_by(Notification.created_at.desc())
        .limit(8)
        .all()
    )
    announcements = (
        db.query(Announcement)
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .limit(6)
        .all()
    )
    activity = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
    task_activity = db.query(TaskActivity).order_by(TaskActivity.created_at.desc()).limit(8).all()
    enabled_automations = db.query(AutomationRule).filter(AutomationRule.is_enabled.is_(True)).count()
    overdue_tasks = db.query(func.count(Task.id)).filter(Task.sla_status == "breached").scalar() or 0
    pending_approvals = db.query(func.count(TaskApproval.id)).filter(TaskApproval.status == "PENDING").scalar() or 0
    total_admins = db.query(func.count(User.id)).filter(User.role.in_(["ADMIN", "SUPER_ADMIN"])).scalar() or 0
    risk = team_risk_summary(db, organization_id=None)
    at_risk_orgs = sorted(comparison, key=lambda item: (item["overdue_tasks"], item["tasks"]), reverse=True)[:3]
    return {
        "overview": {
            "total_organizations": db.query(func.count(Organization.id)).scalar() or 0,
            "total_users": db.query(func.count(User.id)).scalar() or 0,
            "total_admins": total_admins,
            "total_active_tasks": db.query(func.count(Task.id)).filter(Task.status != "DONE").scalar() or 0,
            "overdue_tasks": overdue_tasks,
            "pending_approvals": pending_approvals,
            "enabled_automations": enabled_automations,
        },
        "organization_comparison": comparison,
        "at_risk_organizations": at_risk_orgs,
        "critical_notifications": [
            {"id": item.id, "title": item.title, "message": item.message, "severity": item.severity, "organization_id": item.organization_id, "created_at": item.created_at}
            for item in critical_notifications
        ],
        "important_announcements": [
            {"id": item.id, "title": item.title, "severity": item.severity, "organization_id": item.organization_id, "is_pinned": item.is_pinned, "created_at": item.created_at}
            for item in announcements
        ],
        "automation_health": {
            "enabled_rules": enabled_automations,
            "recent_runs": [
                {"id": item.id, "name": item.name, "organization_id": item.organization_id, "last_triggered_at": item.last_triggered_at, "is_enabled": item.is_enabled}
                for item in db.query(AutomationRule).order_by(AutomationRule.last_triggered_at.desc().nullslast(), AutomationRule.created_at.desc()).limit(6).all()
            ],
        },
        "audit_activity": [
            {"id": item.id, "action": item.action, "entity_type": item.entity_type, "details": item.details, "organization_id": item.organization_id, "created_at": item.created_at}
            for item in activity
        ],
        "latest_platform_activity": [
            {"id": item.id, "message": item.message, "event_type": item.action_type, "created_at": item.created_at}
            for item in task_activity
        ],
        "risk_overview": risk,
    }
