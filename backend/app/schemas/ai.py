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
