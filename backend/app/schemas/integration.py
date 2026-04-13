from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IntegrationConfigPayload(BaseModel):
    is_enabled: bool = False
    config: dict = {}


class IntegrationRead(BaseModel):
    id: int | None = None
    provider: str
    is_enabled: bool
    config: dict
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class EmailSendRequest(BaseModel):
    recipient_ids: list[int]
    subject: str
    body: str
    task_id: int | None = None


class EmailHistoryRead(BaseModel):
    id: int
    organization_id: int
    sender_user_id: int
    recipient_ids: list[int] = []
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
