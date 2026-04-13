from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.models.task import Task
from app.models.user import User
from app.services.task_service import compute_task_risk, enrich_task


def _risk_level(score: int):
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _task_reasons(task: Task, workload_map: dict[int, int]):
    reasons = []
    now = datetime.now(timezone.utc)
    due_at = task.due_at
    if due_at and due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)
    if task.status == "BLOCKED":
        reasons.append("Task is blocked")
    if task.priority in {"high", "critical"}:
        reasons.append(f"{task.priority.title()} priority")
    if due_at and due_at < now:
        reasons.append("Due date already passed")
    if workload_map.get(task.assignee_id or 0, 0) >= 5:
        reasons.append("Assignee workload is elevated")
    if task.subtask_progress.get("open", 0) >= 3:
        reasons.append("Several subtasks remain open")
    if not reasons:
        reasons.append("Monitoring based on due date, priority, and activity pattern")
    return reasons


def _task_query(db: Session, organization_id: int | None = None):
    query = db.query(Task).options(joinedload(Task.assignee).joinedload(User.team), joinedload(Task.subtasks))
    if organization_id is not None:
        query = query.filter(Task.organization_id == organization_id)
    return query


def sla_risk_summary(db: Session, *, organization_id: int | None = None):
    tasks = _task_query(db, organization_id).all()
    workload_map = defaultdict(int)
    for task in tasks:
        if task.status != "DONE" and task.assignee_id:
            workload_map[task.assignee_id] += 1
    rows = []
    for task in tasks:
        enrich_task(task, db)
        score = min(100, compute_task_risk(task, db) + (10 if task.status == "BLOCKED" else 0) + (5 * min(workload_map.get(task.assignee_id or 0, 0), 5)))
        rows.append(
            {
                "task_id": task.id,
                "title": task.title,
                "assignee": task.assignee.full_name if task.assignee else "Unassigned",
                "team": task.assignee.team.name if task.assignee and task.assignee.team else "No team",
                "risk_score": score,
                "risk_level": _risk_level(score),
                "reasons": _task_reasons(task, workload_map),
            }
        )
    return sorted(rows, key=lambda item: item["risk_score"], reverse=True)[:25]


def user_risk_summary(db: Session, *, organization_id: int | None = None):
    users = db.query(User).options(joinedload(User.team), joinedload(User.assigned_tasks)).filter(User.is_active.is_(True))
    if organization_id is not None:
        users = users.filter(User.organization_id == organization_id)
    rows = []
    for user in users.all():
        open_tasks = [task for task in user.assigned_tasks if task.status != "DONE"]
        breached = len([task for task in open_tasks if task.sla_status == "breached"])
        high_priority = len([task for task in open_tasks if task.priority in {"high", "critical"}])
        overload_score = min(100, len(open_tasks) * 10 + breached * 18 + high_priority * 8)
        rows.append(
            {
                "user_id": user.id,
                "full_name": user.full_name,
                "team": user.team.name if user.team else "No team",
                "open_tasks": len(open_tasks),
                "breached_tasks": breached,
                "high_priority_tasks": high_priority,
                "overload_score": overload_score,
                "risk_level": _risk_level(overload_score),
            }
        )
    return sorted(rows, key=lambda item: item["overload_score"], reverse=True)


def team_risk_summary(db: Session, *, organization_id: int | None = None):
    task_rows = sla_risk_summary(db, organization_id=organization_id)
    grouped = defaultdict(list)
    for row in task_rows:
        grouped[row["team"]].append(row)
    results = []
    for team_name, rows in grouped.items():
        avg_risk = int(sum(item["risk_score"] for item in rows) / max(len(rows), 1))
        results.append(
            {
                "team_id": None,
                "team_name": team_name,
                "open_tasks": len(rows),
                "breached_tasks": len([item for item in rows if item["risk_level"] in {"high", "critical"}]),
                "avg_risk_score": avg_risk,
                "risk_level": _risk_level(avg_risk),
            }
        )
    return sorted(results, key=lambda item: item["avg_risk_score"], reverse=True)
