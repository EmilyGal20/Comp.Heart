import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.automation import AutomationRule
from app.models.notification import Notification
from app.models.task import Task
from app.services.notification_service import create_notification
from app.services.task_service import enrich_task


def create_rule(db: Session, payload):
    rule = AutomationRule(
        name=payload.name,
        description=payload.description,
        organization_id=payload.organization_id,
        trigger_type=payload.trigger_type,
        condition_json=json.dumps(payload.condition_json),
        action_json=json.dumps(payload.action_json),
        is_enabled=payload.is_enabled,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def evaluate_rules(db: Session, event_type: str, payload: dict) -> list[dict]:
    rules = db.query(AutomationRule).filter(
        AutomationRule.trigger_type == event_type,
        AutomationRule.is_enabled.is_(True),
    ).all()

    matches: list[dict] = []
    for rule in rules:
        conditions = json.loads(rule.condition_json)
        action = json.loads(rule.action_json)
        matched = all(payload.get(key) == value for key, value in conditions.items())
        if matched:
            matches.append({"rule": rule.name, "organization_id": rule.organization_id, "action": action, "payload": payload})
    return matches


def run_sla_scan(db: Session) -> list[dict]:
    now = datetime.now(timezone.utc)
    tasks = db.query(Task).all()
    events: list[dict] = []

    for task in tasks:
        task = enrich_task(task, db)
        due_at = task.due_at
        if due_at and due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=timezone.utc)
        if task.status != "done" and due_at and due_at < now:
            duplicate = (
                db.query(Notification)
                .filter(
                    Notification.user_id == task.assignee_id,
                    Notification.type == "sla",
                    Notification.title == "SLA breach detected",
                    Notification.message.like(f"{task.title}%"),
                    Notification.is_read.is_(False),
                )
                .count()
            )
            if not duplicate:
                create_notification(
                    db,
                    title="SLA breach detected",
                    message=f"{task.title} is overdue and needs immediate attention.",
                    organization_id=task.organization_id,
                    type_="sla",
                    severity="critical",
                    user_id=task.assignee_id,
                    role_target="MANAGER",
                )
            events.append({"type": "sla_breach", "organization_id": task.organization_id, "task_id": task.id, "task_title": task.title})
    return events


def get_recent_automation_events(db: Session) -> list[dict]:
    now = datetime.now(timezone.utc)
    events: list[dict] = []
    tasks = db.query(Task).all()

    for task in tasks:
        due_at = task.due_at
        if due_at and due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=timezone.utc)
        if task.status != "done" and due_at and due_at < now:
            events.append({"type": "sla_breach", "organization_id": task.organization_id, "task_id": task.id, "task_title": task.title})
    return events
