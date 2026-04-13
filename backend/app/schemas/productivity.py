from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import TeamRead, UserRead


class KnowledgeVersionRead(BaseModel):
    id: int
    knowledge_item_id: int
    version_number: int
    title_snapshot: str
    content_snapshot: str
    summary_snapshot: str
    created_at: datetime
    editor: Optional[UserRead] = None

    class Config:
        from_attributes = True


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    severity: str = "medium"
    is_pinned: bool = False
    expires_at: datetime | None = None
    target_role: str | None = None
    target_team_id: int | None = None
    organization_id: int | None = None


class AnnouncementUpdate(AnnouncementCreate):
    pass


class AnnouncementRead(BaseModel):
    id: int
    organization_id: int
    title: str
    content: str
    severity: str
    is_pinned: bool
    expires_at: datetime | None = None
    target_role: str | None = None
    target_team_id: int | None = None
    created_at: datetime
    creator: Optional[UserRead] = None
    target_team: Optional[TeamRead] = None
    is_read: bool = False

    class Config:
        from_attributes = True


class MeetingSummaryCreate(BaseModel):
    title: str
    raw_notes: str
    team_id: int | None = None
    organization_id: int | None = None


class MeetingSummaryRead(BaseModel):
    id: int
    organization_id: int
    team_id: int | None = None
    title: str
    raw_notes: str
    summary: str
    action_items: list[str] = []
    decisions: list[str] = []
    followups: list[str] = []
    created_at: datetime
    creator: Optional[UserRead] = None
    team: Optional[TeamRead] = None

    class Config:
        from_attributes = True


class SelfNoteCreate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False
    color: str = "cyan"


class SelfNoteUpdate(SelfNoteCreate):
    pass


class SelfNoteRead(BaseModel):
    id: int
    title: str
    content: str
    is_pinned: bool
    color: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
