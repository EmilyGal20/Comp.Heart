from pydantic import BaseModel, Field


class SearchResultItem(BaseModel):
    id: str
    title: str
    subtitle: str | None = None
    snippet: str | None = None
    path: str | None = None
    type: str
    organization_id: int | None = None
    score: float


class SearchGroup(BaseModel):
    type: str
    label: str
    count: int
    items: list[SearchResultItem]


class GlobalSearchResponse(BaseModel):
    query: str
    used_ai_ranking: bool = False
    groups: list[SearchGroup]
    total_results: int


class AISearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=300)
    organization_id: int | None = None
