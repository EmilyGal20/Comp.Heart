from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.knowledge import KnowledgeRead
from app.schemas.user import UserRead


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


class TaskStatusUpdate(BaseModel):
    status: str


class TaskRead(BaseModel):
    id: int
    title: str
    description: str
    organization_id: int
    status: str
    priority: str
    tags: List[str] = []
    due_at: Optional[datetime] = None
    sla_hours: int
    sla_status: str
    created_at: datetime
    updated_at: datetime
    risk_score: int = 0
    assignee: Optional[UserRead] = None
    creator: Optional[UserRead] = None
    related_knowledge: Optional[KnowledgeRead] = None
    related_knowledge_ids: List[int] = []
    related_knowledge_items: List[KnowledgeRead] = []
    comments: List[TaskCommentRead] = []
    activities: List[TaskActivityRead] = []
    attachments: List[TaskAttachmentRead] = []

    class Config:
        from_attributes = True


class TaskAIActionResponse(BaseModel):
    action: str
    result: str
