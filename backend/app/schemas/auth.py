from pydantic import BaseModel, Field, field_validator

from app.schemas.organization import OrganizationRead
from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    organization_slug: str | None = Field(default=None, max_length=80)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str):
        return value.strip().lower()

    @field_validator("organization_slug", mode="before")
    @classmethod
    def normalize_organization_slug(cls, value):
        if value in {"", None}:
            return None
        return str(value).strip().lower()

    @field_validator("organization_slug")
    @classmethod
    def validate_organization_slug(cls, value: str | None):
        if value is None:
            return None
        if not value.replace("-", "").isalnum():
            raise ValueError("organization_slug may only contain lowercase letters, numbers, and hyphens")
        return value


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    organization: OrganizationRead
