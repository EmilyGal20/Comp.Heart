from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_ADMIN, ROLE_SUPER_ADMIN
from app.core.realtime import publish_event
from app.models.knowledge import KnowledgeItem
from app.models.productivity import Announcement, AnnouncementRead, KnowledgeVersion, MeetingSummary, SelfNote
from app.models.task import Task
from app.models.user import User
from app.services.ai_service import suggest_task_plan
from app.services.audit_service import log_audit_event
from app.services.knowledge_service import attach_tags, slugify
from app.services.task_service import create_task


def create_knowledge_version(db: Session, *, item: KnowledgeItem, editor_id: int | None):
    current_max = db.query(KnowledgeVersion).filter(KnowledgeVersion.knowledge_item_id == item.id).count()
    version = KnowledgeVersion(
        knowledge_item_id=item.id,
        version_number=current_max + 1,
        title_snapshot=item.title,
        content_snapshot=item.content,
        summary_snapshot=item.summary,
        edited_by=editor_id,
    )
    db.add(version)
    db.flush()
    return version


def list_knowledge_versions(db: Session, *, item_id: int):
    return (
        db.query(KnowledgeVersion)
        .options(joinedload(KnowledgeVersion.editor))
        .filter(KnowledgeVersion.knowledge_item_id == item_id)
        .order_by(KnowledgeVersion.version_number.desc())
        .all()
    )


def update_knowledge_item(db: Session, *, item: KnowledgeItem, payload, actor: User):
    create_knowledge_version(db, item=item, editor_id=actor.id)
    item.title = payload.title
    item.slug = slugify(payload.title)
    item.category = payload.category
    item.content = payload.content
    item.summary = payload.summary
    item.author_id = payload.author_id
    item.is_published = payload.is_published
    item.tags = attach_tags(db, payload.tag_names)
    db.add(item)
    log_audit_event(db, organization_id=item.organization_id, user_id=actor.id, action="knowledge_updated", entity_type="KnowledgeItem", entity_id=item.id, details=item.title)
    db.commit()
    db.refresh(item)
    item.current_version = db.query(KnowledgeVersion).filter(KnowledgeVersion.knowledge_item_id == item.id).count() + 1
    publish_event("knowledge_updated", {"message": f"{actor.full_name} updated {item.title}", "knowledge_id": item.id}, organization_id=item.organization_id)
    return item


def restore_knowledge_version(db: Session, *, item: KnowledgeItem, version: KnowledgeVersion, actor: User):
    create_knowledge_version(db, item=item, editor_id=actor.id)
    item.title = version.title_snapshot
    item.slug = slugify(version.title_snapshot)
    item.content = version.content_snapshot
    item.summary = version.summary_snapshot
    db.add(item)
    log_audit_event(db, organization_id=item.organization_id, user_id=actor.id, action="knowledge_restored", entity_type="KnowledgeItem", entity_id=item.id, details=f"version {version.version_number}")
    db.commit()
    db.refresh(item)
    item.current_version = db.query(KnowledgeVersion).filter(KnowledgeVersion.knowledge_item_id == item.id).count() + 1
    return item


def _announcement_scope_query(db: Session, *, current_user: User):
    query = db.query(Announcement).options(joinedload(Announcement.creator), joinedload(Announcement.target_team), joinedload(Announcement.reads))
    if current_user.role != ROLE_SUPER_ADMIN:
        query = query.filter(Announcement.organization_id == current_user.organization_id)
    return query


def list_announcements(
    db: Session,
    *,
    current_user: User,
    important_only: bool = False,
    organization_id: int | None = None,
):
    query = _announcement_scope_query(db, current_user=current_user)
    if current_user.role == ROLE_SUPER_ADMIN and organization_id:
        query = query.filter(Announcement.organization_id == organization_id)
    now = datetime.now(timezone.utc)
    query = query.filter((Announcement.expires_at.is_(None)) | (Announcement.expires_at >= now))
    items = query.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc()).all()
    visible = []
    for item in items:
        if item.target_role and item.target_role != current_user.role and current_user.role != ROLE_SUPER_ADMIN:
            continue
        if item.target_team_id and current_user.team_id != item.target_team_id and current_user.role != ROLE_SUPER_ADMIN:
            continue
        if important_only and not (item.is_pinned or item.severity in {"high", "critical"}):
            continue
        item.is_read = any(read.user_id == current_user.id and read.is_read for read in item.reads)
        visible.append(item)
    return visible


def create_announcement(db: Session, *, payload, actor: User, organization_id: int):
    announcement = Announcement(
        organization_id=organization_id,
        title=payload.title,
        content=payload.content,
        severity=payload.severity,
        is_pinned=payload.is_pinned,
        created_by=actor.id,
        expires_at=payload.expires_at,
        target_role=payload.target_role,
        target_team_id=payload.target_team_id,
    )
    db.add(announcement)
    db.flush()
    log_audit_event(db, organization_id=organization_id, user_id=actor.id, action="announcement_created", entity_type="Announcement", entity_id=announcement.id, details=announcement.title)
    db.commit()
    db.refresh(announcement)
    publish_event("announcement_created", {"message": announcement.title, "severity": announcement.severity}, organization_id=organization_id)
    return announcement


def update_announcement(db: Session, *, announcement: Announcement, payload, actor: User):
    announcement.title = payload.title
    announcement.content = payload.content
    announcement.severity = payload.severity
    announcement.is_pinned = payload.is_pinned
    announcement.expires_at = payload.expires_at
    announcement.target_role = payload.target_role
    announcement.target_team_id = payload.target_team_id
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    publish_event("announcement_updated", {"message": f"{actor.full_name} updated {announcement.title}", "severity": announcement.severity}, organization_id=announcement.organization_id)
    return announcement


def mark_announcement_read(db: Session, *, announcement: Announcement, user: User):
    record = db.query(AnnouncementRead).filter(AnnouncementRead.announcement_id == announcement.id, AnnouncementRead.user_id == user.id).first()
    if not record:
        record = AnnouncementRead(announcement_id=announcement.id, user_id=user.id, is_read=True, read_at=datetime.now(timezone.utc))
        db.add(record)
    else:
        record.is_read = True
        record.read_at = datetime.now(timezone.utc)
        db.add(record)
    db.commit()
    return {"read": True}


def summarize_meeting_notes(db: Session, *, payload, actor: User, organization_id: int):
    suggestions, used_openai, _summary = suggest_task_plan(db, prompt=payload.raw_notes, user=actor)
    action_items = [item["title"] for item in suggestions[:4]]
    decisions = [f"Decision: prioritize {item['title']}" for item in suggestions[:2]]
    followups = [f"Follow up on {item['title'].lower()}" for item in suggestions[2:4]]
    summary = " ".join(
        [
            f"This meeting focused on {payload.title.lower()}.",
            "The main outcomes were alignment on priority work, ownership clarity, and the need for follow-through.",
        ]
    )
    meeting = MeetingSummary(
        organization_id=organization_id,
        team_id=payload.team_id,
        title=payload.title,
        raw_notes=payload.raw_notes,
        summary=summary,
        created_by=actor.id,
    )
    meeting.action_items = action_items
    meeting.decisions = decisions
    meeting.followups = followups
    db.add(meeting)
    db.flush()
    log_audit_event(db, organization_id=organization_id, user_id=actor.id, action="meeting_summary_created", entity_type="MeetingSummary", entity_id=meeting.id, details=meeting.title)
    db.commit()
    db.refresh(meeting)
    meeting.used_openai = used_openai
    publish_event("meeting_summary_created", {"message": f"{actor.full_name} created meeting summary {meeting.title}"}, organization_id=organization_id)
    return meeting


def list_meetings(db: Session, *, current_user: User):
    query = db.query(MeetingSummary).options(joinedload(MeetingSummary.creator), joinedload(MeetingSummary.team))
    if current_user.role != ROLE_SUPER_ADMIN:
        query = query.filter(MeetingSummary.organization_id == current_user.organization_id)
    return query.order_by(MeetingSummary.created_at.desc()).all()


def create_tasks_from_meeting(db: Session, *, meeting: MeetingSummary, actor: User):
    # Assignee must live in the meeting's org. Super admins and cross-org viewers often use a
    # home org; forcing actor.id as assignee caused 400 "Assignee must belong to the same organization."
    assignee_in_org = actor.id if actor.organization_id == meeting.organization_id else None
    created = []
    for action_item in meeting.action_items or []:
        if not (action_item and str(action_item).strip()):
            continue
        title = str(action_item).strip()[:220]
        description = f"From meeting: {meeting.title}\n\n{action_item}\n\n(Generated from meeting summary #{meeting.id}.)"[:10000]
        payload = type(
            "MeetingTaskPayload",
            (),
            {
                "title": title,
                "description": description,
                "status": "TODO",
                "priority": "medium",
                "tags": ["meeting-action", "meeting"],
                "related_knowledge_ids": [],
                "external_refs": [f"Meeting summary #{meeting.id}"],
                "assignee_id": assignee_in_org,
                "due_at": None,
                "sla_hours": 24,
                "related_knowledge_id": None,
                "parent_task_id": None,
                "sprint_id": None,
            },
        )
        created.append(create_task(db, payload, meeting.organization_id, actor))
    publish_event("meeting_tasks_created", {"message": f"{actor.full_name} created tasks from {meeting.title}", "count": len(created)}, organization_id=meeting.organization_id)
    return created


def list_self_notes(db: Session, *, user: User, search: str | None = None):
    query = db.query(SelfNote).filter(SelfNote.user_id == user.id)
    if search:
        like = f"%{search.lower()}%"
        query = query.filter((SelfNote.title.ilike(like)) | (SelfNote.content.ilike(like)))
    return query.order_by(SelfNote.is_pinned.desc(), SelfNote.updated_at.desc()).all()


def create_self_note(db: Session, *, payload, user: User):
    note = SelfNote(user_id=user.id, title=payload.title, content=payload.content, is_pinned=payload.is_pinned, color=payload.color)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def update_self_note(db: Session, *, note: SelfNote, payload, user: User):
    if note.user_id != user.id:
        raise HTTPException(status_code=403, detail="Self notes are private")
    note.title = payload.title
    note.content = payload.content
    note.is_pinned = payload.is_pinned
    note.color = payload.color
    db.add(note)
    db.commit()
    db.refresh(note)
    return note
