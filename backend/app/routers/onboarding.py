from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.onboarding import OnboardingProgressUpdate, OnboardingResponse
from app.services.onboarding_service import get_user_onboarding, list_onboarding_steps, update_onboarding_step_progress
from app.utils.dependencies import get_current_user, resolve_org_scope


router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("", response_model=list[dict])
def get_onboarding_steps(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db) if (organization_id or current_user.role != "SUPER_ADMIN") else None
    steps = list_onboarding_steps(db, current_user=current_user, organization_id=scoped_org_id)
    return [
        {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "role_target": item.role_target,
            "action_path": item.action_path,
            "action_label": item.action_label,
            "step_type": item.step_type,
            "organization_id": item.organization_id,
        }
        for item in steps
    ]


@router.get("/me", response_model=OnboardingResponse)
def get_my_onboarding(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_user_onboarding(db, user=current_user)


@router.patch("/steps/{step_id}")
def patch_step_progress(
    step_id: int,
    payload: OnboardingProgressUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    progress = update_onboarding_step_progress(db, step_id=step_id, current_user=current_user, is_completed=payload.is_completed)
    return {"id": progress.id, "step_id": progress.step_id, "is_completed": progress.is_completed, "completed_at": progress.completed_at}
