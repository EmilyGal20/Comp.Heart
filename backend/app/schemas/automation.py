from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


ALLOWED_AUTOMATION_TRIGGERS = {
    "task.created",
    "task.updated",
    "task.overdue",
    "knowledge.updated",
    "approval.updated",
    "recurring.generated",
}


class AutomationRuleCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=3, max_length=1200)
    organization_id: Optional[int] = None
    trigger_type: str = Field(min_length=3, max_length=80)
    condition_json: Dict[str, Any] = Field(default_factory=dict)
    action_json: Dict[str, Any] = Field(default_factory=dict)
    scope_json: Dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True

    @field_validator("trigger_type")
    @classmethod
    def validate_trigger_type(cls, value: str):
        if value not in ALLOWED_AUTOMATION_TRIGGERS:
            raise ValueError("Unsupported automation trigger")
        return value

    @model_validator(mode="after")
    def validate_structure(self):
        if not self.action_json:
            raise ValueError("action_json must include at least one action")
        return self


class AutomationRuleUpdate(AutomationRuleCreate):
    pass


class AutomationRuleRead(BaseModel):
    id: int
    name: str
    description: str
    organization_id: int
    trigger_type: str
    condition_json: str
    action_json: str
    scope_json: str
    is_enabled: bool
    last_triggered_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AutomationEvaluateRequest(BaseModel):
    event_type: Literal[
        "task.created",
        "task.updated",
        "task.overdue",
        "knowledge.updated",
        "approval.updated",
        "recurring.generated",
    ]
    payload: Dict[str, Any] = Field(default_factory=dict)


class AutomationEvaluateResponse(BaseModel):
    matches: list[dict]
