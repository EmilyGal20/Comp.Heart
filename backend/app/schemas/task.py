from datetime import datetime
from typing import List, Optional

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.knowledge import KnowledgeRead
from app.schemas.user import UserRead
from app.schemas.work_management import TaskApprovalRead, TaskMessageRead


class TaskCommentRead(BaseModel):
    id: int
    content: str
    created_at: datetime
    author: Optional[UserRead] = None

    class Config:
        from_attributes = True


class TaskCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class TaskActivityRead(BaseModel):
    id: int
    action_type: str
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    message: str
    created_at: datetime
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


class TaskAttachmentRead(BaseModel):
    id: int
    file_name: str
    file_path: str
    created_at: datetime
    uploader: Optional[UserRead] = None

    class Config:
        from_attributes = True


class TaskWatcherRead(BaseModel):
    id: int
    created_at: datetime
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


class TaskAIActionRequest(BaseModel):
    action: str = Field(min_length=3, max_length=80)


class TaskCreate(BaseModel):
    title: str = Field(min_length=4, max_length=220)
    description: str = Field(min_length=4, max_length=10000)
    organization_id: Optional[int] = None
    status: Literal["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"] = "TODO"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    tags: List[str] = Field(default_factory=list)
    assignee_id: Optional[int] = None
    creator_id: Optional[int] = None
    due_at: Optional[datetime] = None
    sla_hours: int = Field(default=24, ge=1, le=720)
    related_knowledge_id: Optional[int] = None
    related_knowledge_ids: List[int] = Field(default_factory=list)
    external_refs: List[str] = Field(default_factory=list, max_length=10)
    parent_task_id: Optional[int] = None
    sprint_id: Optional[int] = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        return [item.strip()[:40] for item in value if item and item.strip()][:12]

    @field_validator("external_refs")
    @classmethod
    def validate_refs(cls, value):
        return [item.strip()[:500] for item in value if item and item.strip()][:10]


class TaskUpdate(BaseModel):
    title: str = Field(min_length=4, max_length=220)
    description: str = Field(min_length=4, max_length=10000)
    status: Literal["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"]
    priority: Literal["low", "medium", "high", "critical"]
    tags: List[str] = Field(default_factory=list)
    assignee_id: Optional[int] = None
    due_at: Optional[datetime] = None
    sla_hours: int = Field(ge=1, le=720)
    related_knowledge_id: Optional[int] = None
    related_knowledge_ids: List[int] = Field(default_factory=list)
    external_refs: List[str] = Field(default_factory=list, max_length=10)
    parent_task_id: Optional[int] = None
    sprint_id: Optional[int] = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        return [item.strip()[:40] for item in value if item and item.strip()][:12]

    @field_validator("external_refs")
    @classmethod
    def validate_refs(cls, value):
        return [item.strip()[:500] for item in value if item and item.strip()][:10]


class TaskStatusUpdate(BaseModel):
    status: Literal["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"]


class TaskSubtaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=220)
    description: str = Field(default="", max_length=5000)
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    assignee_id: Optional[int] = None
    due_at: Optional[datetime] = None
    sla_hours: int = Field(default=24, ge=1, le=720)
    tags: List[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        return [item.strip()[:40] for item in value if item and item.strip()][:12]


class TaskRead(BaseModel):
    id: int
    title: str
    description: str
    organization_id: int
    status: str
    priority: str
    tags: List[str] = Field(default_factory=list)
    backlog_order: int = 0
    due_at: Optional[datetime] = None
    sla_hours: int
    sla_status: str
    created_at: datetime
    updated_at: datetime
    risk_score: int = 0
    parent_task_id: Optional[int] = None
    sprint_id: Optional[int] = None
    assignee: Optional[UserRead] = None
    creator: Optional[UserRead] = None
    related_knowledge: Optional[KnowledgeRead] = None
    related_knowledge_ids: List[int] = Field(default_factory=list)
    related_knowledge_items: List[KnowledgeRead] = Field(default_factory=list)
    external_refs: List[str] = Field(default_factory=list)
    comments: List[TaskCommentRead] = Field(default_factory=list)
    activities: List[TaskActivityRead] = Field(default_factory=list)
    attachments: List[TaskAttachmentRead] = Field(default_factory=list)
    watchers: List[TaskWatcherRead] = Field(default_factory=list)
    subtasks: List["TaskReadLight"] = Field(default_factory=list)
    subtask_progress: dict = Field(default_factory=dict)
    approvals: List[TaskApprovalRead] = Field(default_factory=list)
    messages: List[TaskMessageRead] = Field(default_factory=list)

    class Config:
        from_attributes = True


class TaskReadLight(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    assignee: Optional[UserRead] = None
    due_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskAIActionResponse(BaseModel):
    action: str
    result: str


TaskRead.model_rebuild()
