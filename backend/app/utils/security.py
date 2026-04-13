from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import get_settings


def create_access_token(*, subject: str, user_id: int, role: str, organization_slug: str | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {"sub": subject, "user_id": user_id, "role": role, "organization_slug": organization_slug, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")
