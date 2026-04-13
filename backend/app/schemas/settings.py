from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.organization import OrganizationRead
from app.schemas.user import TeamRead


class ProfileSettingsRead(BaseModel):
    full_name: str
    email: str
    title: str
    responsibilities: str
    role: str
    organization: Optional[OrganizationRead] = None
    team: Optional[TeamRead] = None
    notification_email: bool
    notification_desktop: bool


class ProfileSettingsUpdate(BaseModel):
    full_name: str
    title: str
    responsibilities: str = ""
    notification_email: bool = True
    notification_desktop: bool = True


class WorkspaceSettingsRead(BaseModel):
    default_task_view: str
    density: str
    theme_mode: str
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class WorkspaceSettingsUpdate(BaseModel):
    default_task_view: str = "list"
    density: str = "comfortable"
    theme_mode: str = "dark"


class OrganizationSettingsRead(BaseModel):
    default_sla_hours: int
    require_approval_for_critical: bool
    recurring_auto_run: bool
    slack_notifications_enabled: bool
    email_notifications_enabled: bool
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class OrganizationSettingsUpdate(BaseModel):
    default_sla_hours: int = 24
    require_approval_for_critical: bool = True
    recurring_auto_run: bool = True
    slack_notifications_enabled: bool = False
    email_notifications_enabled: bool = True
