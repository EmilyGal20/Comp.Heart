from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.user import UserRead


class SprintBase(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    goal: Optional[str] = Field(default=None, max_length=600)
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class SprintCreate(SprintBase):
    organization_id: Optional[int] = None


class SprintStatusUpdate(BaseModel):
    status: Literal["PLANNED", "ACTIVE", "COMPLETED"]


class SprintRead(SprintBase):
    id: int
    organization_id: int
    status: str
    created_at: datetime
    tasks: list[dict] = Field(default_factory=list)
    progress: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class TaskTemplateBase(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    title_template: str = Field(min_length=3, max_length=220)
    description_template: str = Field(min_length=3, max_length=5000)
    default_priority: Literal["low", "medium", "high", "critical"] = "medium"
    default_tags: list[str] = Field(default_factory=list)
    default_sla: int = Field(default=24, ge=1, le=720)


class TaskTemplateCreate(TaskTemplateBase):
    organization_id: Optional[int] = None


class TaskTemplateRead(TaskTemplateBase):
    id: int
    organization_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RecurringTaskCreate(BaseModel):
    organization_id: Optional[int] = None
    template_id: Optional[int] = None
    source_task_id: Optional[int] = None
    frequency: Literal["daily", "weekly", "monthly"]
    next_run_at: datetime
    is_active: bool = True

    @model_validator(mode="after")
    def validate_source(self):
        if not self.template_id and not self.source_task_id:
            raise ValueError("template_id or source_task_id is required")
        return self


class RecurringTaskRead(BaseModel):
    id: int
    organization_id: int
    template_id: Optional[int] = None
    source_task_id: Optional[int] = None
    frequency: str
    next_run_at: datetime
    is_active: bool
    created_at: datetime
    template: Optional[TaskTemplateRead] = None

    class Config:
        from_attributes = True


class TaskApprovalCreate(BaseModel):
    task_id: int
    reason: str | None = Field(default=None, max_length=500)


class TaskApprovalAction(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


class ApprovalTaskLight(BaseModel):
    id: int
    title: str
    organization_id: int
    status: str
    priority: str

    class Config:
        from_attributes = True


class TaskApprovalRead(BaseModel):
    id: int
    task_id: int
    reason: str | None = None
    status: str
    created_at: datetime
    task: Optional[ApprovalTaskLight] = None
    requester: Optional[UserRead] = None
    approver: Optional[UserRead] = None

    class Config:
        from_attributes = True


class TaskMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class BacklogReorderRequest(BaseModel):
    ordered_ids: list[int] = Field(min_length=1, max_length=500)


class TaskMessageRead(BaseModel):
    id: int
    task_id: int
    message: str
    created_at: datetime
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


class AuditLogRead(BaseModel):
    id: int
    organization_id: int
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


class GlobalSearchResult(BaseModel):
    type: str
    id: int
    title: str
    subtitle: Optional[str] = None
    path: str


class ReportSummary(BaseModel):
    tasks_by_status: dict
    tasks_by_user: list[dict]
    sla_performance: dict
    overdue_tasks: list[dict]
    sprint_performance: list[dict]


class PermissionMatrixEntry(BaseModel):
    capability: str
    super_admin: bool
    admin: bool
    manager: bool
    user: bool
