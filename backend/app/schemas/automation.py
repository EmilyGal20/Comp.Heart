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
    is_enabled: bool = True


class AutomationRuleRead(BaseModel):
    id: int
    name: str
    description: str
    organization_id: int
    trigger_type: str
    condition_json: str
    action_json: str
    is_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AutomationEvaluateRequest(BaseModel):
    event_type: str
    payload: Dict[str, Any]


class AutomationEvaluateResponse(BaseModel):
    matches: list[dict]
