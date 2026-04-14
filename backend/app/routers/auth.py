from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import Team
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.user import UserRead
from app.utils.dependencies import get_current_user
from app.utils.security import create_access_token, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.email == payload.email)
        .first()
    )
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    if user.organization and not user.organization.is_active and user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Organization is inactive")
    if payload.organization_slug and user.organization.slug != payload.organization_slug and user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=401, detail="User does not belong to the selected organization")

    return LoginResponse(
        access_token=create_access_token(
            subject=user.email,
            user_id=user.id,
            role=user.role,
            organization_slug=user.organization.slug if user.organization else payload.organization_slug,
        ),
        user=user,
        organization=user.organization,
    )


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/organizations")
def login_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).filter(Organization.is_active.is_(True)).order_by(Organization.name.asc()).all()
