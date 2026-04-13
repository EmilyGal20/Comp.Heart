from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_SUPER_ADMIN
from app.core.realtime import publish_event
from app.models.knowledge import KnowledgeItem
from app.models.notification import Notification
from app.models.productivity import Announcement, OnboardingStep, UserOnboardingProgress
from app.models.task import Task
from app.models.user import User


def _profile_completion_percent(user: User) -> int:
    checks = [
        bool(user.full_name.strip()),
        bool(user.title.strip()),
        bool(user.responsibilities.strip()),
        bool(user.team_id),
        bool(user.email.strip()),
    ]
    return int((sum(checks) / len(checks)) * 100)


def _ensure_progress_rows(db: Session, *, user: User):
    steps = (
        db.query(OnboardingStep)
        .filter(
            OnboardingStep.is_active.is_(True),
            (OnboardingStep.organization_id.is_(None)) | (OnboardingStep.organization_id == user.organization_id),
            (OnboardingStep.role_target.is_(None)) | (OnboardingStep.role_target == user.role),
        )
        .order_by(OnboardingStep.sort_order.asc(), OnboardingStep.id.asc())
        .all()
    )
    existing_ids = {
        item.step_id
        for item in db.query(UserOnboardingProgress).filter(UserOnboardingProgress.user_id == user.id).all()
    }
    for step in steps:
        if step.id not in existing_ids:
            db.add(UserOnboardingProgress(user_id=user.id, step_id=step.id, is_completed=False))
    db.commit()


def get_user_onboarding(db: Session, *, user: User):
    _ensure_progress_rows(db, user=user)
    progress_items = (
        db.query(UserOnboardingProgress)
        .options(joinedload(UserOnboardingProgress.step))
        .filter(UserOnboardingProgress.user_id == user.id)
        .join(OnboardingStep, OnboardingStep.id == UserOnboardingProgress.step_id)
        .order_by(OnboardingStep.sort_order.asc(), OnboardingStep.id.asc())
        .all()
    )
    steps = [
        {
            "id": item.step.id,
            "title": item.step.title,
            "description": item.step.description,
            "action_path": item.step.action_path,
            "action_label": item.step.action_label,
            "step_type": item.step.step_type,
            "role_target": item.step.role_target,
            "is_completed": item.is_completed,
            "completed_at": item.completed_at,
        }
        for item in progress_items
    ]
    total_steps = len(steps)
    completed_steps = len([step for step in steps if step["is_completed"]])
    completion_percent = int((completed_steps / total_steps) * 100) if total_steps else 0
    recommended_documents = (
        db.query(KnowledgeItem)
        .filter(KnowledgeItem.organization_id == user.organization_id)
        .order_by(KnowledgeItem.updated_at.desc())
        .limit(3)
        .all()
    )
    recommended_tasks = (
        db.query(Task)
        .filter(Task.organization_id == user.organization_id, ((Task.assignee_id == user.id) | (Task.creator_id == user.id)))
        .order_by(Task.due_at.asc().nullslast(), Task.updated_at.desc())
        .limit(3)
        .all()
    )
    announcements = (
        db.query(Announcement)
        .filter(Announcement.organization_id == user.organization_id)
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .limit(3)
        .all()
    )
    contacts = (
        db.query(User)
        .filter(User.organization_id == user.organization_id, User.id != user.id)
        .order_by(User.role.desc(), User.full_name.asc())
        .limit(4)
        .all()
    )
    return {
        "role": user.role,
        "organization_id": user.organization_id,
        "summary": {
            "completion_percent": completion_percent,
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "profile_completion_percent": _profile_completion_percent(user),
            "recommended_documents": [{"id": item.id, "title": item.title, "summary": item.summary} for item in recommended_documents],
            "recommended_tasks": [{"id": item.id, "title": item.title, "status": item.status, "priority": item.priority} for item in recommended_tasks],
            "key_contacts": [{"id": item.id, "full_name": item.full_name, "title": item.title, "team": item.team.name if item.team else None} for item in contacts],
            "announcements": [{"id": item.id, "title": item.title, "severity": item.severity} for item in announcements],
        },
        "steps": steps,
    }


def list_onboarding_steps(db: Session, *, current_user: User, organization_id: int | None = None):
    query = db.query(OnboardingStep).order_by(OnboardingStep.sort_order.asc(), OnboardingStep.id.asc())
    if current_user.role != ROLE_SUPER_ADMIN:
        query = query.filter((OnboardingStep.organization_id.is_(None)) | (OnboardingStep.organization_id == current_user.organization_id))
    elif organization_id:
        query = query.filter((OnboardingStep.organization_id.is_(None)) | (OnboardingStep.organization_id == organization_id))
    return query.all()


def update_onboarding_step_progress(db: Session, *, step_id: int, current_user: User, is_completed: bool):
    progress = (
        db.query(UserOnboardingProgress)
        .filter(UserOnboardingProgress.user_id == current_user.id, UserOnboardingProgress.step_id == step_id)
        .first()
    )
    if not progress:
        progress = UserOnboardingProgress(user_id=current_user.id, step_id=step_id, is_completed=is_completed)
        db.add(progress)
    progress.is_completed = is_completed
    progress.completed_at = datetime.now(timezone.utc) if is_completed else None
    db.add(progress)
    db.commit()
    db.refresh(progress)
    publish_event(
        "onboarding_updated",
        {
            "message": f"{current_user.full_name} {'completed' if is_completed else 'reopened'} an onboarding step",
            "step_id": step_id,
            "is_completed": is_completed,
        },
        organization_id=current_user.organization_id,
        user_id=current_user.id,
    )
    return progress


def organization_onboarding_summary(db: Session, *, organization_id: int):
    users = db.query(User).filter(User.organization_id == organization_id, User.is_active.is_(True)).all()
    if not users:
        return {"users_in_progress": 0, "average_completion": 0, "profiles_incomplete": 0}
    summaries = [get_user_onboarding(db, user=user) for user in users]
    average = int(sum(item["summary"]["completion_percent"] for item in summaries) / len(summaries))
    incomplete_profiles = len([user for user in users if _profile_completion_percent(user) < 80])
    return {"users_in_progress": len([item for item in summaries if item["summary"]["completion_percent"] < 100]), "average_completion": average, "profiles_incomplete": incomplete_profiles}
