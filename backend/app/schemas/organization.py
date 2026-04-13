from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class OrganizationBase(BaseModel):
    name: str
    slug: str
    company_type: str
    industry: str
    description: Optional[str] = None
    is_active: bool = True


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str
    slug: str
    company_type: str
    industry: str
    description: Optional[str] = None


class OrganizationStatusUpdate(BaseModel):
    is_active: bool


class OrganizationRead(OrganizationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationSummary(BaseModel):
    organization: OrganizationRead
    user_count: int
    team_count: int
    task_count: int
    overdue_tasks: int
    knowledge_count: int
    unread_notifications: int
    latest_activity: Optional[str] = None
