from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings


password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(*, subject: str, user_id: int, role: str, organization_slug: str | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {"sub": subject, "user_id": user_id, "role": role, "organization_slug": organization_slug, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    if password_hash.startswith("$2"):
        return password_context.verify(password, password_hash)
    return password == password_hash
