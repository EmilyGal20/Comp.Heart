from pydantic import BaseModel


class DashboardSummary(BaseModel):
    scope_label: str
    role: str
    total_users: int
    total_knowledge_items: int
    total_tasks: int
    open_tasks: int
    overdue_tasks: int
    sla_warning_tasks: int
    unread_notifications: int
    active_automation_rules: int
    recent_automation_events: list[dict]
    recent_notifications: list[dict]
    task_breakdown: dict
    focus_items: list[dict]
