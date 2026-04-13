from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

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
    content: str


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
    action: str


class TaskCreate(BaseModel):
    title: str
    description: str
    organization_id: Optional[int] = None
    status: str = "TODO"
    priority: str = "medium"
    tags: List[str] = []
    assignee_id: Optional[int] = None
    creator_id: Optional[int] = None
    due_at: Optional[datetime] = None
    sla_hours: int = 24
    related_knowledge_id: Optional[int] = None
    related_knowledge_ids: List[int] = []
    external_refs: List[str] = []
    parent_task_id: Optional[int] = None
    sprint_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: str
    description: str
    status: str
    priority: str
    tags: List[str] = []
    assignee_id: Optional[int] = None
    due_at: Optional[datetime] = None
    sla_hours: int
    related_knowledge_id: Optional[int] = None
    related_knowledge_ids: List[int] = []
    external_refs: List[str] = []
    parent_task_id: Optional[int] = None
    sprint_id: Optional[int] = None


class TaskStatusUpdate(BaseModel):
    status: str


class TaskSubtaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    assignee_id: Optional[int] = None
    due_at: Optional[datetime] = None
    sla_hours: int = 24
    tags: List[str] = []


class TaskRead(BaseModel):
    id: int
    title: str
    description: str
    organization_id: int
    status: str
    priority: str
    tags: List[str] = []
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
    related_knowledge_ids: List[int] = []
    related_knowledge_items: List[KnowledgeRead] = []
    external_refs: List[str] = []
    comments: List[TaskCommentRead] = []
    activities: List[TaskActivityRead] = []
    attachments: List[TaskAttachmentRead] = []
    watchers: List[TaskWatcherRead] = []
    subtasks: List["TaskReadLight"] = []
    subtask_progress: dict = {}
    approvals: List[TaskApprovalRead] = []
    messages: List[TaskMessageRead] = []

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
