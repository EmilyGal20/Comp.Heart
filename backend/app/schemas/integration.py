from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class IntegrationConfigPayload(BaseModel):
    is_enabled: bool = False
    config: dict[str, Any] = Field(default_factory=dict)


class IntegrationRead(BaseModel):
    id: int | None = None
    provider: str
    is_enabled: bool
    config: dict
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class EmailSendRequest(BaseModel):
    recipient_ids: list[int] = Field(min_length=1, max_length=25)
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=6000)
    task_id: int | None = None

    @field_validator("recipient_ids")
    @classmethod
    def validate_recipient_ids(cls, value: list[int]):
        unique_ids = [item for item in dict.fromkeys(value) if item > 0]
        if not unique_ids:
            raise ValueError("At least one valid recipient is required")
        return unique_ids


class EmailHistoryRead(BaseModel):
    id: int
    organization_id: int
    sender_user_id: int
    recipient_ids: list[int] = Field(default_factory=list)
    subject: str
    body: str
    task_id: int | None = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class IntegrationSummary(BaseModel):
    github: IntegrationRead
    slack: IntegrationRead
    email: IntegrationRead
