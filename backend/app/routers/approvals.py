from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.work_management import TaskApproval
from app.schemas.approvals import ApprovalDashboardResponse
from app.schemas.work_management import TaskApprovalAction, TaskApprovalRead
from app.services.approval_service import approvals_dashboard, decide_approval_from_dashboard, list_approvals
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope


router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("/dashboard", response_model=ApprovalDashboardResponse)
def get_dashboard(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db) if (organization_id or current_user.role != "SUPER_ADMIN") else None
    return approvals_dashboard(db, current_user=current_user, organization_id=scoped_org_id)


@router.get("", response_model=list[TaskApprovalRead])
def get_approvals(
    organization_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    requester_id: int | None = Query(default=None),
    approver_id: int | None = Query(default=None),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db) if (organization_id or current_user.role != "SUPER_ADMIN") else None
    return list_approvals(
        db,
        current_user=current_user,
        organization_id=scoped_org_id,
        status=status,
        requester_id=requester_id,
        approver_id=approver_id,
        created_from=created_from,
        created_to=created_to,
    )


@router.patch("/{approval_id}", response_model=TaskApprovalRead)
def patch_approval(
    approval_id: int,
    payload: TaskApprovalAction,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    approval = db.query(TaskApproval).filter(TaskApproval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if current_user.role not in {"SUPER_ADMIN", "ADMIN"} and approval.requested_by != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return decide_approval_from_dashboard(db, approval=approval, status=payload.status, actor=current_user)
