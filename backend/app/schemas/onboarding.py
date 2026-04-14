from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class OnboardingStepRead(BaseModel):
    id: int
    title: str
    description: str
    action_path: Optional[str] = None
    action_label: Optional[str] = None
    step_type: str
    role_target: Optional[str] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    organization_id: Optional[int] = None


class OnboardingSummary(BaseModel):
    completion_percent: int
    completed_steps: int
    total_steps: int
    profile_completion_percent: int
    recommended_documents: list[dict]
    recommended_tasks: list[dict]
    key_contacts: list[dict]
    announcements: list[dict]


class OnboardingResponse(BaseModel):
    role: str
    organization_id: Optional[int] = None
    summary: OnboardingSummary
    steps: list[OnboardingStepRead]


class OnboardingProgressUpdate(BaseModel):
    is_completed: bool


class OnboardingStepListItem(BaseModel):
    id: int
    title: str
    description: str
    role_target: Optional[str] = None
    action_path: Optional[str] = None
    action_label: Optional[str] = None
    step_type: str = Field(max_length=80)
    organization_id: Optional[int] = None
