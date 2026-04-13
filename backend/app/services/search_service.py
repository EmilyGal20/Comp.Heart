from collections import defaultdict

from sqlalchemy.orm import Session

from app.core.permissions import ROLE_SUPER_ADMIN
from app.models.collaboration import ChatChannel, ChatMessage
from app.models.knowledge import KnowledgeItem
from app.models.productivity import Announcement, MeetingSummary
from app.models.task import Task
from app.models.user import User
from app.models.work_management import TaskApproval, TaskMessage


def _score(query: str, *values: str):
    terms = [term for term in query.lower().split() if term]
    haystack = " ".join([value or "" for value in values]).lower()
    score = 0.0
    for term in terms:
        if term in haystack:
            score += 1.0 + (haystack.count(term) * 0.2)
    return score


def global_search(db: Session, *, query: str, current_user: User, organization_id: int | None = None, use_ai: bool = False):
    scoped_org_id = None if current_user.role == ROLE_SUPER_ADMIN and organization_id is None else (organization_id or current_user.organization_id)
    groups = defaultdict(list)

    tasks_query = db.query(Task)
    if scoped_org_id is not None:
        tasks_query = tasks_query.filter(Task.organization_id == scoped_org_id)
    if current_user.role == "USER":
        tasks_query = tasks_query.filter((Task.assignee_id == current_user.id) | (Task.creator_id == current_user.id))
    for task in tasks_query.limit(40).all():
        score = _score(query, task.title, task.description or "", " ".join(task.tags or []))
        if score:
            groups["tasks"].append({"id": f"task-{task.id}", "title": task.title, "subtitle": f"{task.status} - {task.priority}", "snippet": task.description[:180] if task.description else "", "path": "/tasks", "type": "task", "organization_id": task.organization_id, "score": score})

    knowledge_query = db.query(KnowledgeItem)
    if scoped_org_id is not None:
        knowledge_query = knowledge_query.filter(KnowledgeItem.organization_id == scoped_org_id)
    for item in knowledge_query.limit(30).all():
        score = _score(query, item.title, item.summary or "", item.content or "")
        if score:
            groups["knowledge"].append({"id": f"knowledge-{item.id}", "title": item.title, "subtitle": item.category, "snippet": item.summary[:180] if item.summary else "", "path": "/knowledge", "type": "knowledge", "organization_id": item.organization_id, "score": score})

    meetings_query = db.query(MeetingSummary)
    if scoped_org_id is not None:
        meetings_query = meetings_query.filter(MeetingSummary.organization_id == scoped_org_id)
    for item in meetings_query.limit(20).all():
        score = _score(query, item.title, item.summary or "", item.raw_notes or "")
        if score:
            groups["meetings"].append({"id": f"meeting-{item.id}", "title": item.title, "subtitle": "Meeting summary", "snippet": item.summary[:180], "path": "/meetings", "type": "meeting", "organization_id": item.organization_id, "score": score})

    announcements_query = db.query(Announcement)
    if scoped_org_id is not None:
        announcements_query = announcements_query.filter(Announcement.organization_id == scoped_org_id)
    for item in announcements_query.limit(20).all():
        score = _score(query, item.title, item.content)
        if score:
            groups["announcements"].append({"id": f"announcement-{item.id}", "title": item.title, "subtitle": item.severity, "snippet": item.content[:180], "path": "/announcements", "type": "announcement", "organization_id": item.organization_id, "score": score})

    users_query = db.query(User)
    if current_user.role != ROLE_SUPER_ADMIN or scoped_org_id is not None:
        target_org_id = scoped_org_id or current_user.organization_id
        users_query = users_query.filter(User.organization_id == target_org_id)
    for item in users_query.limit(40).all():
        score = _score(query, item.full_name, item.email, item.title, item.responsibilities or "")
        if score:
            groups["people"].append({"id": f"user-{item.id}", "title": item.full_name, "subtitle": f"{item.title} - {item.role}", "snippet": item.email, "path": f"/people/{item.id}", "type": "user", "organization_id": item.organization_id, "score": score})

    approvals_query = db.query(TaskApproval).join(Task, Task.id == TaskApproval.task_id)
    if scoped_org_id is not None:
        approvals_query = approvals_query.filter(Task.organization_id == scoped_org_id)
    elif current_user.role != ROLE_SUPER_ADMIN:
        approvals_query = approvals_query.filter(Task.organization_id == current_user.organization_id)
    if current_user.role == "USER":
        approvals_query = approvals_query.filter((TaskApproval.requested_by == current_user.id) | (Task.assignee_id == current_user.id))
    for item in approvals_query.limit(20).all():
        score = _score(query, item.reason or "", item.status, item.task.title if item.task else "")
        if score:
            groups["approvals"].append({"id": f"approval-{item.id}", "title": item.task.title if item.task else f"Approval {item.id}", "subtitle": item.status, "snippet": item.reason or "", "path": "/approvals", "type": "approval", "organization_id": item.task.organization_id if item.task else None, "score": score})

    task_messages_query = db.query(TaskMessage).join(Task, Task.id == TaskMessage.task_id)
    if scoped_org_id is not None:
        task_messages_query = task_messages_query.filter(Task.organization_id == scoped_org_id)
    for item in task_messages_query.limit(20).all():
        score = _score(query, item.message)
        if score:
            groups["discussions"].append({"id": f"task-message-{item.id}", "title": item.task.title if item.task else "Task discussion", "subtitle": "Task thread", "snippet": item.message[:180], "path": "/tasks", "type": "discussion", "organization_id": item.task.organization_id if item.task else None, "score": score})

    chat_query = db.query(ChatMessage).join(ChatChannel, ChatChannel.id == ChatMessage.channel_id)
    if scoped_org_id is not None:
        chat_query = chat_query.filter(ChatChannel.organization_id == scoped_org_id)
    for item in chat_query.limit(20).all():
        score = _score(query, item.message)
        if score:
            groups["chat"].append({"id": f"chat-{item.id}", "title": item.channel.name if item.channel else "Chat message", "subtitle": "Channel message", "snippet": item.message[:180], "path": "/chat", "type": "chat", "organization_id": item.channel.organization_id if item.channel else None, "score": score})

    if current_user.role == ROLE_SUPER_ADMIN:
        from app.models.organization import Organization

        org_query = db.query(Organization)
        if organization_id:
            org_query = org_query.filter(Organization.id == organization_id)
        for item in org_query.limit(20).all():
            score = _score(query, item.name, item.slug, item.industry or "", item.description or "")
            if score:
                groups["organizations"].append({"id": f"organization-{item.id}", "title": item.name, "subtitle": item.industry or item.company_type, "snippet": item.description or "", "path": "/organizations", "type": "organization", "organization_id": item.id, "score": score})

    labels = {
        "tasks": "Tasks",
        "knowledge": "Knowledge",
        "meetings": "Meetings",
        "announcements": "Announcements",
        "people": "People",
        "approvals": "Approvals",
        "discussions": "Task Discussions",
        "chat": "Chat",
        "organizations": "Organizations",
    }
    grouped = []
    total = 0
    for key, items in groups.items():
        sorted_items = sorted(items, key=lambda item: item["score"], reverse=True)[:8]
        grouped.append({"type": key, "label": labels.get(key, key.title()), "count": len(sorted_items), "items": sorted_items})
        total += len(sorted_items)
    grouped.sort(key=lambda item: item["count"], reverse=True)
    return {"query": query, "used_ai_ranking": use_ai, "groups": grouped, "total_results": total}
