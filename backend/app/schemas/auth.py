from pydantic import BaseModel, EmailStr, Field

from app.schemas.organization import OrganizationRead
from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    organization_slug: str | None = Field(default=None, max_length=80, pattern=r"^[a-z0-9-]+$")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    organization: OrganizationRead
