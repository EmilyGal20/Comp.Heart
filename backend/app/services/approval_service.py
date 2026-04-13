from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_SUPER_ADMIN
from app.core.realtime import publish_event
from app.models.task import Task
from app.models.user import User
from app.models.work_management import TaskApproval
from app.services.audit_service import log_audit_event


def _approval_query(db: Session):
    return db.query(TaskApproval).options(
        joinedload(TaskApproval.task).joinedload(Task.assignee).joinedload(User.team),
        joinedload(TaskApproval.requester).joinedload(User.team),
        joinedload(TaskApproval.approver).joinedload(User.team),
    )


def list_approvals(
    db: Session,
    *,
    current_user: User,
    organization_id: int | None = None,
    status: str | None = None,
    requester_id: int | None = None,
    approver_id: int | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
):
    query = _approval_query(db).join(Task, Task.id == TaskApproval.task_id)
    if current_user.role == ROLE_SUPER_ADMIN:
        if organization_id:
            query = query.filter(Task.organization_id == organization_id)
    elif current_user.role == "ADMIN":
        query = query.filter(Task.organization_id == current_user.organization_id)
    else:
        query = query.filter((TaskApproval.requested_by == current_user.id) | (TaskApproval.approved_by == current_user.id) | (Task.assignee_id == current_user.id))
    if status:
        query = query.filter(TaskApproval.status == status.upper())
    if requester_id:
        query = query.filter(TaskApproval.requested_by == requester_id)
    if approver_id:
        query = query.filter(TaskApproval.approved_by == approver_id)
    if created_from:
        query = query.filter(TaskApproval.created_at >= created_from)
    if created_to:
        query = query.filter(TaskApproval.created_at <= created_to)
    return query.order_by(TaskApproval.created_at.desc()).all()


def approvals_dashboard(db: Session, *, current_user: User, organization_id: int | None = None):
    items = list_approvals(db, current_user=current_user, organization_id=organization_id)
    pending = [item for item in items if item.status == "PENDING"]
    awaiting_me = len([item for item in pending if current_user.role in {"ADMIN", "SUPER_ADMIN"} or item.task.assignee_id == current_user.id])
    by_team = {}
    by_org = {}
    for item in items:
        team_name = item.task.assignee.team.name if item.task and item.task.assignee and item.task.assignee.team else "Unassigned"
        by_team[team_name] = by_team.get(team_name, 0) + 1
        org_id = item.task.organization_id if item.task else None
        by_org[str(org_id)] = by_org.get(str(org_id), 0) + 1
    return {
        "summary": {
            "pending_count": len(pending),
            "awaiting_me": awaiting_me,
            "approvals_by_team": [{"team": key, "count": value} for key, value in by_team.items()],
            "approvals_by_organization": [{"organization_id": key, "count": value} for key, value in by_org.items()],
            "recent_actions": [
                {
                    "id": item.id,
                    "status": item.status,
                    "task_title": item.task.title if item.task else "Task",
                    "created_at": item.created_at,
                }
                for item in items[:6]
            ],
        },
        "items": items,
    }


def decide_approval_from_dashboard(db: Session, *, approval: TaskApproval, status: str, actor: User):
    normalized = status.upper()
    if normalized not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Invalid approval status")
    approval.status = normalized
    approval.approved_by = actor.id
    db.add(approval)
    log_audit_event(db, organization_id=approval.task.organization_id, user_id=actor.id, action="approval_decided", entity_type="TaskApproval", entity_id=approval.id, details=normalized)
    db.commit()
    db.refresh(approval)
    publish_event("approval_updated", {"message": f"{actor.full_name} {normalized.lower()} approval for {approval.task.title}", "approval_id": approval.id}, organization_id=approval.task.organization_id)
    return approval
