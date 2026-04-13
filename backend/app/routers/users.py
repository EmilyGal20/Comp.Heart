from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_ADMIN
from app.db.session import get_db
from app.models.knowledge import KnowledgeItem
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import Team, User
from app.schemas.user import UserCreate, UserDashboard, UserRead
from app.utils.dependencies import get_current_user, require_min_role, require_same_org_or_super


router = APIRouter(prefix="/users", tags=["users"])


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
    require_same_org_or_super(current_user, organization_id)
    if current_user.role != "SUPER_ADMIN" and payload.role == "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only super admins can create super admin users")
    user = User(
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        title=payload.title,
        responsibilities=payload.responsibilities,
        team_id=payload.team_id,
        organization_id=organization_id,
        password=payload.password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.id == user.id)
        .first()
    )


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
    return {
        "profile": current_user,
        "summary": {
            "my_open_tasks": len([task for task in my_tasks if task.status != "done"]),
            "overdue_tasks": len([task for task in my_tasks if task.sla_status == "breached"]),
            "unread_notifications": len([item for item in notifications if not item.is_read]),
            "recommended_docs": len(knowledge),
        },
        "my_tasks": [
            {"id": task.id, "title": task.title, "status": task.status, "priority": task.priority, "sla_status": task.sla_status, "due_at": task.due_at}
            for task in my_tasks
        ],
        "recent_notifications": [
            {"id": item.id, "title": item.title, "severity": item.severity, "type": item.type, "is_read": item.is_read}
            for item in notifications
        ],
        "recommended_knowledge": [
            {"id": item.id, "title": item.title, "summary": item.summary, "category": item.category}
            for item in knowledge
        ],
        "recent_activity": [
            {"type": "task", "label": task.title, "detail": f"{task.status} / {task.priority}"}
            for task in my_tasks[:3]
        ],
    }


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = (
        db.query(User)
        .options(joinedload(User.organization), joinedload(User.team).joinedload(Team.organization))
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role != "SUPER_ADMIN" and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    if current_user.role == "USER" and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role == "MANAGER" and user.team_id != current_user.team_id and user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user
