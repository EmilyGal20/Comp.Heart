from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.organization import OrganizationRead


class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None
    organization_id: int


class TeamRead(TeamBase):
    id: int
    created_at: datetime
    organization: Optional[OrganizationRead] = None

    class Config:
        from_attributes = True


class UserRead(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    title: str
    responsibilities: str
    is_active: bool
    created_at: datetime
    organization_id: int
    team_id: Optional[int] = None
    organization: Optional[OrganizationRead] = None
    team: Optional[TeamRead] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    full_name: str
    email: str
    role: str
    title: str
    responsibilities: str = ""
    team_id: Optional[int] = None
    organization_id: Optional[int] = None
    password: str = "demo123"
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str
    email: str
    role: str
    title: str
    responsibilities: str = ""
    team_id: Optional[int] = None
    organization_id: Optional[int] = None
    is_active: bool = True


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserDashboard(BaseModel):
    profile: UserRead
    summary: dict
    my_tasks: list[dict]
    recent_notifications: list[dict]
    recommended_knowledge: list[dict]
    recent_activity: list[dict]
