from typing import Generic, TypeVar

from pydantic import BaseModel, Field


class PaginationMeta(BaseModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    has_next: bool
    has_previous: bool


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    meta: PaginationMeta
