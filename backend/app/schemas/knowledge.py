from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.user import UserRead


class KnowledgeCreate(BaseModel):
    title: str
    category: str
    content: str
    summary: str
    tag_names: List[str] = []
    author_id: Optional[int] = None
    organization_id: Optional[int] = None
    is_published: bool = True


class KnowledgeUpdate(BaseModel):
    title: str
    category: str
    content: str
    summary: str
    tag_names: List[str] = []
    author_id: Optional[int] = None
    is_published: bool = True


class KnowledgeTagRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class KnowledgeRead(BaseModel):
    id: int
    title: str
    slug: str
    category: str
    organization_id: int
    content: str
    summary: str
    is_published: bool
    created_at: datetime
    updated_at: datetime
    current_version: int = 1
    author: Optional[UserRead] = None
    tags: List[KnowledgeTagRead] = []

    class Config:
        from_attributes = True
