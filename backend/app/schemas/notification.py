from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserRead


class NotificationRead(BaseModel):
    id: int
    title: str
    message: str
    organization_id: int
    type: str
    severity: str
    role_target: Optional[str] = None
    is_org_wide: bool
    is_read: bool
    created_at: datetime
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


class NotificationBulkReadRequest(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=100)

    @field_validator("ids")
    @classmethod
    def validate_ids(cls, value: list[int]):
        unique_ids = [item for item in dict.fromkeys(value) if item > 0]
        if not unique_ids:
            raise ValueError("At least one valid notification id is required")
        return unique_ids
