from typing import Callable

from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.permissions import ROLE_ADMIN, ROLE_MANAGER, ROLE_SUPER_ADMIN, ROLE_USER, has_role
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import Team, User


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.id == user_id)
        .first()
    )
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User unavailable")
    return user


def require_min_role(minimum_role: str) -> Callable:
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not has_role(current_user, minimum_role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return dependency


def resolve_org_scope(
    requested_org_id: int | None,
    current_user: User,
    db: Session,
    allow_global: bool = True,
) -> int | None:
    if current_user.role == ROLE_SUPER_ADMIN:
        if requested_org_id is None and allow_global:
            return None
        if requested_org_id is None:
            raise HTTPException(status_code=400, detail="Organization context required")
        organization = db.query(Organization).filter(Organization.id == requested_org_id).first()
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        return requested_org_id

    if requested_org_id and requested_org_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return current_user.organization_id


def require_same_org_or_super(current_user: User, organization_id: int):
    if current_user.role != ROLE_SUPER_ADMIN and current_user.organization_id != organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")


def manager_scope_team_id(current_user: User) -> int | None:
    if current_user.role == ROLE_MANAGER:
        return current_user.team_id
    return None
