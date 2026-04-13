from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_ADMIN, ROLE_MANAGER
from app.db.session import get_db
from app.models.automation import AutomationRule
from app.schemas.automation import AutomationEvaluateRequest, AutomationRuleCreate, AutomationRuleRead
from app.services.automation_service import create_rule, evaluate_rules
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope


router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("", response_model=list[AutomationRuleRead])
def list_automation_rules(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    query = db.query(AutomationRule)
    if scoped_org_id is not None:
        query = query.filter(AutomationRule.organization_id == scoped_org_id)
    return query.order_by(AutomationRule.created_at.desc()).all()


@router.post("", response_model=AutomationRuleRead)
def create_automation_rule(
    payload: AutomationRuleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_ADMIN)),
):
    payload.organization_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_rule(db, payload)


@router.get("/{rule_id}", response_model=AutomationRuleRead)
def get_automation_rule(rule_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    if current_user.role != "SUPER_ADMIN" and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return rule


@router.patch("/{rule_id}/toggle", response_model=AutomationRuleRead)
def toggle_rule(rule_id: int, db: Session = Depends(get_db), current_user=Depends(require_min_role(ROLE_ADMIN))):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    if current_user.role != "SUPER_ADMIN" and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    rule.is_enabled = not rule.is_enabled
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/evaluate")
def evaluate_automation(
    payload: AutomationEvaluateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_min_role(ROLE_MANAGER)),
):
    matches = evaluate_rules(db, payload.event_type, payload.payload)
    if current_user.role != "SUPER_ADMIN":
        matches = [match for match in matches if match["payload"].get("organization_id", current_user.organization_id) == current_user.organization_id]
    return {"matches": matches}
