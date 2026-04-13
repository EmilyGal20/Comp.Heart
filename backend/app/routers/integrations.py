from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_ADMIN
from app.db.session import get_db
from app.models.user import User
from app.schemas.integration import EmailHistoryRead, EmailSendRequest, IntegrationConfigPayload, IntegrationRead, IntegrationSummary
from app.services.integration_service import email_history, get_or_create_integration, list_integrations, send_internal_email, update_integration
from app.utils.dependencies import get_current_user, require_min_role


router = APIRouter(prefix="/integrations", tags=["integrations"])


def _org_id_for_user(current_user: User):
    if current_user.role == "SUPER_ADMIN" and current_user.organization_id is None:
        raise HTTPException(status_code=400, detail="Organization context required")
    return current_user.organization_id


@router.get("", response_model=IntegrationSummary)
def get_integrations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    integrations = list_integrations(db, _org_id_for_user(current_user))
    return {
        "github": integrations["github"],
        "slack": integrations["slack"],
        "email": integrations["email"],
    }


@router.get("/github", response_model=IntegrationRead)
def get_github(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_or_create_integration(db, organization_id=_org_id_for_user(current_user), provider="github")


@router.put("/github", response_model=IntegrationRead)
def put_github(
    payload: IntegrationConfigPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    return update_integration(db, organization_id=_org_id_for_user(current_user), provider="github", payload=payload, actor=current_user)


@router.get("/slack", response_model=IntegrationRead)
def get_slack(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_or_create_integration(db, organization_id=_org_id_for_user(current_user), provider="slack")


@router.put("/slack", response_model=IntegrationRead)
def put_slack(
    payload: IntegrationConfigPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    return update_integration(db, organization_id=_org_id_for_user(current_user), provider="slack", payload=payload, actor=current_user)


@router.get("/email", response_model=IntegrationRead)
def get_email(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_or_create_integration(db, organization_id=_org_id_for_user(current_user), provider="email")


@router.put("/email", response_model=IntegrationRead)
def put_email(
    payload: IntegrationConfigPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    return update_integration(db, organization_id=_org_id_for_user(current_user), provider="email", payload=payload, actor=current_user)


@router.post("/email/send", response_model=EmailHistoryRead)
def send_email(payload: EmailSendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item, _mode = send_internal_email(db, current_user=current_user, payload=payload)
    return item


@router.get("/email/history", response_model=list[EmailHistoryRead])
def get_email_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return email_history(db, current_user=current_user)
