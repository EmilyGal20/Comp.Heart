from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class AutomationRuleCreate(BaseModel):
    name: str
    description: str
    organization_id: Optional[int] = None
    trigger_type: str
    condition_json: Dict[str, Any]
    action_json: Dict[str, Any]
    scope_json: Dict[str, Any] = {}
    is_enabled: bool = True


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
    event_type: str
    payload: Dict[str, Any]


class AutomationEvaluateResponse(BaseModel):
    matches: list[dict]
