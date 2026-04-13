from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_ADMIN, ROLE_SUPER_ADMIN, can_manage_role
from app.core.realtime import publish_event
from app.db.session import get_db
from app.models.knowledge import KnowledgeItem
from app.models.notification import Notification
from app.models.task import Task, TaskActivity, TaskWatcher
from app.models.user import Team, User
from app.schemas.user import UserCreate, UserDashboard, UserRead, UserStatusUpdate, UserUpdate
from app.services.audit_service import log_audit_event
from app.utils.dependencies import get_current_user, require_min_role, require_same_org_or_super


router = APIRouter(prefix="/users", tags=["users"])


def _get_user_or_404(db: Session, user_id: int):
    user = (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _ensure_user_management_scope(current_user: User, organization_id: int, target_role: str):
    require_same_org_or_super(current_user, organization_id)
    if not can_manage_role(current_user, target_role):
        raise HTTPException(status_code=403, detail="You cannot manage the requested role")


@router.get("", response_model=list[UserRead])
def list_users(
    organization_id: int | None = Query(default=None),
    role: str | None = Query(default=None),
    team_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(User).options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
    if current_user.role == "SUPER_ADMIN":
        if organization_id:
            query = query.filter(User.organization_id == organization_id)
    elif current_user.role == "ADMIN":
        query = query.filter(User.organization_id == current_user.organization_id)
    elif current_user.role == "MANAGER":
        query = query.filter(User.organization_id == current_user.organization_id, User.team_id == current_user.team_id)
    else:
        query = query.filter(User.id == current_user.id)
    if role:
        query = query.filter(User.role == role)
    if team_id:
        query = query.filter(User.team_id == team_id)
    return query.order_by(User.full_name.asc()).all()


@router.post("", response_model=UserRead)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    organization_id = payload.organization_id or current_user.organization_id
    _ensure_user_management_scope(current_user, organization_id, payload.role)
    user = User(
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        title=payload.title,
        responsibilities=payload.responsibilities,
        team_id=payload.team_id,
        organization_id=organization_id,
        password=payload.password,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    log_audit_event(db, organization_id=organization_id, user_id=current_user.id, action="user_created", entity_type="User", entity_id=user.id, details=user.email)
    db.commit()
    db.refresh(user)
    created_user = (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.id == user.id)
        .first()
    )
    publish_event("user_updated", {"id": created_user.id, "full_name": created_user.full_name, "role": created_user.role, "message": f"{created_user.full_name} joined the workspace"}, organization_id=created_user.organization_id, user_id=created_user.id)
    return created_user


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    target_user = _get_user_or_404(db, user_id)
    target_organization_id = payload.organization_id or target_user.organization_id
    _ensure_user_management_scope(current_user, target_organization_id, payload.role)
    if current_user.role != ROLE_SUPER_ADMIN and target_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    target_user.full_name = payload.full_name
    target_user.email = payload.email
    target_user.role = payload.role
    target_user.title = payload.title
    target_user.responsibilities = payload.responsibilities
    target_user.team_id = payload.team_id
    target_user.organization_id = target_organization_id
    target_user.is_active = payload.is_active
    db.add(target_user)
    log_audit_event(db, organization_id=target_user.organization_id, user_id=current_user.id, action="user_updated", entity_type="User", entity_id=target_user.id, details=target_user.email)
    db.commit()
    db.refresh(target_user)
    publish_event("user_updated", {"id": target_user.id, "full_name": target_user.full_name, "role": target_user.role, "is_active": target_user.is_active, "message": f"{target_user.full_name} profile was updated"}, organization_id=target_user.organization_id, user_id=target_user.id)
    return _get_user_or_404(db, user_id)


@router.patch("/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_ADMIN)),
):
    target_user = _get_user_or_404(db, user_id)
    _ensure_user_management_scope(current_user, target_user.organization_id, target_user.role)
    target_user.is_active = payload.is_active
    db.add(target_user)
    log_audit_event(db, organization_id=target_user.organization_id, user_id=current_user.id, action="user_status_updated", entity_type="User", entity_id=target_user.id, details=str(target_user.is_active))
    db.commit()
    db.refresh(target_user)
    publish_event("user_updated", {"id": target_user.id, "full_name": target_user.full_name, "is_active": target_user.is_active, "message": f"{target_user.full_name} was {'activated' if target_user.is_active else 'deactivated'}"}, organization_id=target_user.organization_id, user_id=target_user.id)
    return target_user


@router.get("/me/dashboard", response_model=UserDashboard)
def my_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    my_tasks = (
        db.query(Task)
        .filter(Task.organization_id == current_user.organization_id, (Task.assignee_id == current_user.id) | (Task.creator_id == current_user.id))
        .order_by(Task.due_at.asc())
        .limit(5)
        .all()
    )
    notifications = (
        db.query(Notification)
        .filter(
            Notification.organization_id == current_user.organization_id,
            (Notification.user_id == current_user.id)
            | (Notification.is_org_wide.is_(True))
            | (Notification.role_target == current_user.role),
        )
        .order_by(Notification.created_at.desc())
        .limit(6)
        .all()
    )
    knowledge = (
        db.query(KnowledgeItem)
        .filter(KnowledgeItem.organization_id == current_user.organization_id)
        .order_by(KnowledgeItem.updated_at.desc())
        .limit(4)
        .all()
    )
    mentions = (
        db.query(Notification)
        .filter(Notification.organization_id == current_user.organization_id, Notification.user_id == current_user.id, Notification.type == "mention")
        .order_by(Notification.created_at.desc())
        .limit(4)
        .all()
    )
    watched_tasks = (
        db.query(Task)
        .join(TaskWatcher, TaskWatcher.task_id == Task.id)
        .filter(Task.organization_id == current_user.organization_id, TaskWatcher.user_id == current_user.id)
        .order_by(Task.updated_at.desc())
        .limit(5)
        .all()
    )
    recent_activity = (
        db.query(TaskActivity)
        .join(Task, Task.id == TaskActivity.task_id)
        .filter(Task.organization_id == current_user.organization_id)
        .order_by(TaskActivity.created_at.desc())
        .limit(8)
        .all()
    )
    return {
        "profile": current_user,
        "summary": {
            "my_open_tasks": len([task for task in my_tasks if task.status != "DONE"]),
            "overdue_tasks": len([task for task in my_tasks if task.sla_status == "breached"]),
            "unread_notifications": len([item for item in notifications if not item.is_read]),
            "recommended_docs": len(knowledge),
            "mentions": len(mentions),
            "watched_tasks": len(watched_tasks),
        },
        "my_tasks": [
            {"id": task.id, "title": task.title, "status": task.status, "priority": task.priority, "sla_status": task.sla_status, "due_at": task.due_at}
            for task in my_tasks
        ],
        "watched_tasks": [{"id": task.id, "title": task.title, "status": task.status, "priority": task.priority, "sla_status": task.sla_status, "due_at": task.due_at} for task in watched_tasks],
        "mentions": [{"id": item.id, "title": item.title, "message": item.message, "severity": item.severity} for item in mentions],
        "recent_notifications": [
            {"id": item.id, "title": item.title, "severity": item.severity, "type": item.type, "is_read": item.is_read}
            for item in notifications
        ],
        "recommended_knowledge": [
            {"id": item.id, "title": item.title, "summary": item.summary, "category": item.category}
            for item in knowledge
        ],
        "recent_activity": [
            {"type": activity.action_type, "label": activity.message, "detail": f"Task #{activity.task_id}", "created_at": activity.created_at}
            for activity in recent_activity
        ],
    }


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = _get_user_or_404(db, user_id)
    if current_user.role != "SUPER_ADMIN" and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    if current_user.role == "USER" and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role == "MANAGER" and user.team_id != current_user.team_id and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user
