from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class AIChatRequest(BaseModel):
    message: str = Field(min_length=3, max_length=4000)
    conversation_id: Optional[int] = None
    organization_id: Optional[int] = Field(
        default=None,
        description="SUPER_ADMIN: scope new messages to this org's knowledge. Ignored for other roles.",
    )


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
    prompt: str = Field(min_length=5, max_length=4000)
    task_count: int = Field(default=3, ge=1, le=12)
    organization_id: Optional[int] = None
    sprint_id: Optional[int] = None


class AISubtaskGenerationRequest(BaseModel):
    task_id: int = Field(gt=0)
    task_count: int = Field(default=4, ge=1, le=12)


class AITaskSuggestion(BaseModel):
    title: str
    description: str
    priority: str
    suggested_assignee_id: Optional[int] = None
    suggested_assignee_name: Optional[str] = None
    due_in_days: int = 3
    sla_hours: int = 24
    tags: List[str] = Field(default_factory=list)
    related_knowledge_ids: List[int] = Field(default_factory=list)
    related_knowledge_titles: List[str] = Field(default_factory=list)
    risk_level: str = "medium"
    rationale: str = Field(min_length=3, max_length=1200)

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str):
        if value not in {"low", "medium", "high", "critical"}:
            raise ValueError("Invalid task priority")
        return value

    @field_validator("risk_level")
    @classmethod
    def validate_risk_level(cls, value: str):
        if value not in {"low", "medium", "high", "critical"}:
            raise ValueError("Invalid risk level")
        return value


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
    messages: List[AIMessageRead] = Field(default_factory=list)

    class Config:
        from_attributes = True
