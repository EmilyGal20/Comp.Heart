from datetime import datetime
from typing import Optional

from pydantic import BaseModel

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
