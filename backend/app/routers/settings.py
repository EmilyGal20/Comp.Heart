from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_ADMIN
from app.db.session import get_db
from app.models.user import User
from app.schemas.settings import (
    OrganizationSettingsRead,
    OrganizationSettingsUpdate,
    ProfileSettingsRead,
    ProfileSettingsUpdate,
    WorkspaceSettingsRead,
    WorkspaceSettingsUpdate,
)
from app.services.settings_service import get_or_create_organization_setting, get_or_create_workspace_setting
from app.utils.dependencies import get_current_user, require_min_role


router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/profile", response_model=ProfileSettingsRead)
def get_profile_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    workspace = get_or_create_workspace_setting(db, current_user.id)
    return {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "title": current_user.title,
        "responsibilities": current_user.responsibilities,
        "role": current_user.role,
        "organization": current_user.organization,
        "team": current_user.team,
        "notification_email": workspace.notify_email,
        "notification_desktop": workspace.notify_desktop,
    }


@router.put("/profile", response_model=ProfileSettingsRead)
def put_profile_settings(
    payload: ProfileSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = get_or_create_workspace_setting(db, current_user.id)
    current_user.full_name = payload.full_name
    current_user.title = payload.title
    current_user.responsibilities = payload.responsibilities
    workspace.notify_email = payload.notification_email
    workspace.notify_desktop = payload.notification_desktop
    db.add(current_user)
    db.add(workspace)
    db.commit()
    db.refresh(current_user)
    db.refresh(workspace)
    return {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "title": current_user.title,
        "responsibilities": current_user.responsibilities,
        "role": current_user.role,
        "organization": current_user.organization,
        "team": current_user.team,
        "notification_email": workspace.notify_email,
        "notification_desktop": workspace.notify_desktop,
    }


@router.get("/workspace", response_model=WorkspaceSettingsRead)
def get_workspace_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_or_create_workspace_setting(db, current_user.id)


@router.put("/workspace", response_model=WorkspaceSettingsRead)
def put_workspace_settings(
    payload: WorkspaceSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = get_or_create_workspace_setting(db, current_user.id)
    workspace.default_task_view = payload.default_task_view
    workspace.density = payload.density
    workspace.theme_mode = payload.theme_mode
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


@router.get("/organization", response_model=OrganizationSettingsRead)
def get_org_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    if current_user.role == "SUPER_ADMIN" and not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")
    return get_or_create_organization_setting(db, current_user.organization_id)


@router.put("/organization", response_model=OrganizationSettingsRead)
def put_org_settings(
    payload: OrganizationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    if current_user.role == "SUPER_ADMIN" and not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")
    setting = get_or_create_organization_setting(db, current_user.organization_id)
    setting.default_sla_hours = payload.default_sla_hours
    setting.require_approval_for_critical = payload.require_approval_for_critical
    setting.recurring_auto_run = payload.recurring_auto_run
    setting.slack_notifications_enabled = payload.slack_notifications_enabled
    setting.email_notifications_enabled = payload.email_notifications_enabled
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting
