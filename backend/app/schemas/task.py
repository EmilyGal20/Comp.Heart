from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.knowledge import KnowledgeRead
from app.schemas.user import UserRead


class TaskCommentRead(BaseModel):
    id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    title: str
    description: str
    organization_id: Optional[int] = None
    status: str = "todo"
    priority: str = "medium"
    assignee_id: Optional[int] = None
    creator_id: Optional[int] = None
    due_at: Optional[datetime] = None
    sla_hours: int = 24
    related_knowledge_id: Optional[int] = None


class TaskStatusUpdate(BaseModel):
    status: str


class TaskRead(BaseModel):
    id: int
    title: str
    description: str
    organization_id: int
    status: str
    priority: str
    due_at: Optional[datetime] = None
    sla_hours: int
    sla_status: str
    created_at: datetime
    updated_at: datetime
    risk_score: int = 0
    assignee: Optional[UserRead] = None
    creator: Optional[UserRead] = None
    related_knowledge: Optional[KnowledgeRead] = None
    comments: List[TaskCommentRead] = []

    class Config:
        from_attributes = True
