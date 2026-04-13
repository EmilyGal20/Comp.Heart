from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_ADMIN, ROLE_SUPER_ADMIN
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import Team, User
from app.schemas.organization import OrganizationCreate, OrganizationRead, OrganizationSummary
from app.schemas.user import TeamRead, UserRead
from app.services.organization_service import (
    create_organization,
    get_organization_summary,
    list_organizations,
    organization_teams,
    organization_users,
)
from app.utils.dependencies import get_current_user, require_min_role, require_same_org_or_super


router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationSummary])
def list_orgs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    if current_user.role != ROLE_SUPER_ADMIN:
        organization = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
        return [get_organization_summary(db, organization)] if organization else []
    return list_organizations(db)


@router.post("", response_model=OrganizationRead)
def create_org(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_SUPER_ADMIN)),
):
    return create_organization(db, payload)


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_org(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    require_same_org_or_super(current_user, organization_id)
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization


@router.get("/{organization_id}/users", response_model=list[UserRead])
def get_org_users(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    require_same_org_or_super(current_user, organization_id)
    return (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.organization_id == organization_id)
        .order_by(User.full_name.asc())
        .all()
    )


@router.get("/{organization_id}/teams", response_model=list[TeamRead])
def get_org_teams(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    require_same_org_or_super(current_user, organization_id)
    return organization_teams(db, organization_id)


@router.get("/{organization_id}/summary", response_model=OrganizationSummary)
def get_org_summary(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    require_same_org_or_super(current_user, organization_id)
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    return get_organization_summary(db, organization)
