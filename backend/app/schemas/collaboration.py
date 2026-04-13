from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import TeamRead, UserRead


class ChatMessageCreate(BaseModel):
    message: str


class ChatMessageRead(BaseModel):
    id: int
    message: str
    created_at: datetime
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


class ChatChannelCreate(BaseModel):
    name: str
    description: str = ""
    channel_type: str = "ORG"
    team_id: int | None = None
    is_private: bool = False


class ChatChannelRead(BaseModel):
    id: int
    organization_id: int
    name: str
    description: Optional[str] = None
    channel_type: str
    is_private: bool
    team_id: int | None = None
    created_at: datetime
    team: Optional[TeamRead] = None
    member_count: int = 0
    latest_message_preview: str | None = None
    unread_count: int = 0

    class Config:
        from_attributes = True
