from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.automation import AutomationRule
from app.models.knowledge import KnowledgeItem
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.task import Task
from app.models.user import Team, User


def create_organization(db: Session, payload):
    organization = Organization(**payload.model_dump())
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def get_organization_summary(db: Session, organization: Organization):
    return {
        "organization": organization,
        "user_count": db.query(func.count(User.id)).filter(User.organization_id == organization.id).scalar() or 0,
        "task_count": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id).scalar() or 0,
        "overdue_tasks": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id, Task.sla_status == "breached").scalar() or 0,
        "knowledge_count": db.query(func.count(KnowledgeItem.id)).filter(KnowledgeItem.organization_id == organization.id).scalar() or 0,
        "unread_notifications": db.query(func.count(Notification.id)).filter(Notification.organization_id == organization.id, Notification.is_read.is_(False)).scalar() or 0,
    }


def list_organizations(db: Session):
    organizations = db.query(Organization).order_by(Organization.name.asc()).all()
    return [get_organization_summary(db, organization) for organization in organizations]


def organization_users(db: Session, organization_id: int):
    return db.query(User).filter(User.organization_id == organization_id).order_by(User.full_name.asc()).all()


def organization_teams(db: Session, organization_id: int):
    return db.query(Team).filter(Team.organization_id == organization_id).order_by(Team.name.asc()).all()


def organization_overview(db: Session):
    organizations = db.query(Organization).order_by(Organization.name.asc()).all()
    comparison = []
    for organization in organizations:
        comparison.append(
            {
                "id": organization.id,
                "name": organization.name,
                "industry": organization.industry,
                "users": db.query(func.count(User.id)).filter(User.organization_id == organization.id).scalar() or 0,
                "tasks": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id).scalar() or 0,
                "overdue_tasks": db.query(func.count(Task.id)).filter(Task.organization_id == organization.id, Task.sla_status == "breached").scalar() or 0,
                "knowledge_items": db.query(func.count(KnowledgeItem.id)).filter(KnowledgeItem.organization_id == organization.id).scalar() or 0,
                "notifications": db.query(func.count(Notification.id)).filter(Notification.organization_id == organization.id).scalar() or 0,
                "automations": db.query(func.count(AutomationRule.id)).filter(AutomationRule.organization_id == organization.id, AutomationRule.is_enabled.is_(True)).scalar() or 0,
            }
        )
    return comparison
