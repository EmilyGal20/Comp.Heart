from pydantic import BaseModel

from app.schemas.organization import OrganizationRead
from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: str
    password: str
    organization_slug: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    organization: OrganizationRead
