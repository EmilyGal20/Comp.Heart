from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserRead


class SprintBase(BaseModel):
    name: str
    goal: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class SprintCreate(SprintBase):
    organization_id: Optional[int] = None


class SprintStatusUpdate(BaseModel):
    status: str


class SprintRead(SprintBase):
    id: int
    organization_id: int
    status: str
    created_at: datetime
    tasks: list[dict] = []
    progress: dict = {}

    class Config:
        from_attributes = True


class TaskTemplateBase(BaseModel):
    name: str
    title_template: str
    description_template: str
    default_priority: str = "medium"
    default_tags: list[str] = []
    default_sla: int = 24


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
    frequency: str
    next_run_at: datetime
    is_active: bool = True


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


class TaskApprovalAction(BaseModel):
    status: str


class TaskApprovalRead(BaseModel):
    id: int
    task_id: int
    status: str
    created_at: datetime
    requester: Optional[UserRead] = None
    approver: Optional[UserRead] = None

    class Config:
        from_attributes = True


class TaskMessageCreate(BaseModel):
    message: str


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
