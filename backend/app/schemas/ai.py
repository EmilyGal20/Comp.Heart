from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class AIChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


class AIReference(BaseModel):
    id: int
    title: str
    category: str
    summary: str


class AIChatResponse(BaseModel):
    conversation_id: int
    answer: str
    references: List[AIReference]
    used_openai: bool = False


class AITaskGenerationRequest(BaseModel):
    prompt: str
    task_count: int = 3
    organization_id: Optional[int] = None
    sprint_id: Optional[int] = None


class AITaskSuggestion(BaseModel):
    title: str
    description: str
    priority: str
    suggested_assignee_id: Optional[int] = None
    suggested_assignee_name: Optional[str] = None
    due_in_days: int = 3
    sla_hours: int = 24
    tags: List[str] = []
    related_knowledge_ids: List[int] = []
    related_knowledge_titles: List[str] = []
    risk_level: str = "medium"
    rationale: str


class AITaskGenerationResponse(BaseModel):
    suggestions: List[AITaskSuggestion]
    used_openai: bool = False
    summary: str


class AIMessageRead(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class AIConversationRead(BaseModel):
    id: int
    title: str
    organization_id: int
    user_id: Optional[int] = None
    created_at: datetime
    messages: List[AIMessageRead] = []

    class Config:
        from_attributes = True
