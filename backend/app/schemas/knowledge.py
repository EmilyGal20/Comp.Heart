from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class KnowledgeCreate(BaseModel):
    title: str = Field(min_length=4, max_length=180)
    category: str = Field(min_length=2, max_length=80)
    content: str = Field(min_length=10, max_length=50000)
    summary: str = Field(min_length=10, max_length=1000)
    tag_names: List[str] = Field(default_factory=list)
    author_id: Optional[int] = None
    organization_id: Optional[int] = None
    is_published: bool = True


class KnowledgeUpdate(BaseModel):
    title: str = Field(min_length=4, max_length=180)
    category: str = Field(min_length=2, max_length=80)
    content: str = Field(min_length=10, max_length=50000)
    summary: str = Field(min_length=10, max_length=1000)
    tag_names: List[str] = Field(default_factory=list)
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
    tags: List[KnowledgeTagRead] = Field(default_factory=list)

    class Config:
        from_attributes = True
