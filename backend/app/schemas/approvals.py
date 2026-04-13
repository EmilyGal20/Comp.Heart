from pydantic import BaseModel

from app.schemas.work_management import TaskApprovalRead


class ApprovalDashboardSummary(BaseModel):
    pending_count: int
    awaiting_me: int
    approvals_by_team: list[dict]
    approvals_by_organization: list[dict]
    recent_actions: list[dict]


class ApprovalDashboardResponse(BaseModel):
    summary: ApprovalDashboardSummary
    items: list[TaskApprovalRead]
