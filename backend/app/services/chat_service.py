from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_ADMIN, ROLE_SUPER_ADMIN
from app.core.realtime import publish_event
from app.models.collaboration import ChatChannel, ChatMembership, ChatMessage
from app.models.task import Task
from app.models.user import Team, User
from app.services.audit_service import log_audit_event
from app.services.notification_service import create_notification
from app.services.task_service import _resolve_mentions, can_view_task, get_task_by_id, serialize_task_snapshot
from app.services.work_management_service import add_task_message, list_task_messages


def _base_channel_query(db: Session):
    return db.query(ChatChannel).options(
        joinedload(ChatChannel.team),
        joinedload(ChatChannel.memberships).joinedload(ChatMembership.user).joinedload(User.team),
        joinedload(ChatChannel.messages).joinedload(ChatMessage.user).joinedload(User.team),
    )


def _serialize_memberships(channel: ChatChannel):
    return [
        {
            "id": membership.id,
            "user_id": membership.user_id,
            "full_name": membership.user.full_name if membership.user else "Unknown",
            "unread_count": membership.unread_count,
        }
        for membership in channel.memberships
    ]


def _prepare_channel_for_user(channel: ChatChannel, current_user: User):
    latest_message_preview = channel.messages[-1].message[:80] if channel.messages else "No messages yet"
    membership = next((item for item in channel.memberships if item.user_id == current_user.id), None)
    unread_count = membership.unread_count if membership else 0
    member_count = len(channel.memberships)
    memberships = _serialize_memberships(channel)
    display_name = channel.name
    participant_user_id = None
    if channel.channel_type == "DIRECT":
        other_membership = next((item for item in memberships if item["user_id"] != current_user.id), None)
        if other_membership:
            display_name = other_membership["full_name"]
            participant_user_id = other_membership["user_id"]
    return {
        "id": channel.id,
        "organization_id": channel.organization_id,
        "name": channel.name,
        "description": channel.description,
        "channel_type": channel.channel_type,
        "is_private": channel.is_private,
        "team_id": channel.team_id,
        "created_at": channel.created_at,
        "team": channel.team,
        "member_count": member_count,
        "latest_message_preview": latest_message_preview,
        "unread_count": unread_count,
        "display_name": display_name,
        "participant_user_id": participant_user_id,
        "memberships": memberships,
    }


def ensure_chat_scope(current_user: User, channel: ChatChannel):
    if current_user.role == ROLE_SUPER_ADMIN:
        return True
    if channel.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    if channel.channel_type == "TEAM" and current_user.role == "USER" and current_user.team_id != channel.team_id:
        raise HTTPException(status_code=403, detail="Team channel access denied")
    if channel.is_private and not any(membership.user_id == current_user.id for membership in channel.memberships):
        raise HTTPException(status_code=403, detail="Private channel access denied")
    return True


def list_channels(db: Session, *, current_user: User, organization_id: int | None = None):
    query = _base_channel_query(db)
    if current_user.role == ROLE_SUPER_ADMIN:
        if organization_id:
            query = query.filter(ChatChannel.organization_id == organization_id)
    else:
        query = query.filter(ChatChannel.organization_id == current_user.organization_id)
    channels = query.order_by(ChatChannel.channel_type.asc(), ChatChannel.name.asc()).all()
    visible = []
    for channel in channels:
        try:
            ensure_chat_scope(current_user, channel)
        except HTTPException:
            continue
        visible.append(_prepare_channel_for_user(channel, current_user))
    return visible


def create_channel(db: Session, *, current_user: User, organization_id: int, payload):
    if payload.channel_type == "DIRECT":
        if not payload.member_user_id:
            raise HTTPException(status_code=400, detail="Direct messages require a member_user_id")
        if payload.member_user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Direct messages require another user")
        target_user = (
            db.query(User)
            .filter(User.id == payload.member_user_id, User.is_active.is_(True))
            .first()
        )
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        if target_user.organization_id != organization_id:
            raise HTTPException(status_code=403, detail="Cross-organization access denied")
        existing_channels = (
            _base_channel_query(db)
            .filter(ChatChannel.organization_id == organization_id, ChatChannel.channel_type == "DIRECT")
            .all()
        )
        for existing in existing_channels:
            member_ids = sorted(item.user_id for item in existing.memberships)
            if member_ids == sorted([current_user.id, target_user.id]):
                return _prepare_channel_for_user(existing, current_user)
        channel = ChatChannel(
            organization_id=organization_id,
            name=f"dm-{min(current_user.id, target_user.id)}-{max(current_user.id, target_user.id)}",
            description=f"Direct conversation between {current_user.full_name} and {target_user.full_name}",
            channel_type="DIRECT",
            is_private=True,
            created_by=current_user.id,
        )
        db.add(channel)
        db.flush()
        db.add(ChatMembership(channel_id=channel.id, user_id=current_user.id))
        db.add(ChatMembership(channel_id=channel.id, user_id=target_user.id))
        log_audit_event(
            db,
            organization_id=organization_id,
            user_id=current_user.id,
            action="chat_direct_channel_created",
            entity_type="ChatChannel",
            entity_id=channel.id,
            details=target_user.full_name,
        )
        db.commit()
        channel = _base_channel_query(db).filter(ChatChannel.id == channel.id).first()
        publish_event(
            "chat_channel_updated",
            {"message": f"{current_user.full_name} started a direct conversation", "channel_id": channel.id},
            organization_id=organization_id,
        )
        return _prepare_channel_for_user(channel, current_user)

    if current_user.role not in {ROLE_SUPER_ADMIN, ROLE_ADMIN}:
        raise HTTPException(status_code=403, detail="Only admins can create channels")
    if current_user.role != ROLE_SUPER_ADMIN and organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    if payload.channel_type == "TEAM" and not payload.team_id:
        raise HTTPException(status_code=400, detail="Team channel requires team_id")
    channel = ChatChannel(
        organization_id=organization_id,
        team_id=payload.team_id,
        name=payload.name,
        description=payload.description,
        channel_type=payload.channel_type,
        is_private=payload.is_private,
        created_by=current_user.id,
    )
    db.add(channel)
    db.flush()
    members_query = db.query(User).filter(User.organization_id == organization_id, User.is_active.is_(True))
    if payload.channel_type == "TEAM" and payload.team_id:
        members_query = members_query.filter(User.team_id == payload.team_id)
    for member in members_query.all():
        db.add(ChatMembership(channel_id=channel.id, user_id=member.id))
    log_audit_event(db, organization_id=organization_id, user_id=current_user.id, action="chat_channel_created", entity_type="ChatChannel", entity_id=channel.id, details=channel.name)
    db.commit()
    db.refresh(channel)
    publish_event("chat_channel_updated", {"message": f"{current_user.full_name} created #{channel.name}", "channel_id": channel.id}, organization_id=organization_id)
    channel = _base_channel_query(db).filter(ChatChannel.id == channel.id).first()
    return _prepare_channel_for_user(channel, current_user)


def get_channel_messages(db: Session, *, channel_id: int, current_user: User):
    channel = _base_channel_query(db).filter(ChatChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    ensure_chat_scope(current_user, channel)
    membership = db.query(ChatMembership).filter(ChatMembership.channel_id == channel.id, ChatMembership.user_id == current_user.id).first()
    if membership:
        membership.unread_count = 0
        db.add(membership)
        db.commit()
    return (
        db.query(ChatMessage)
        .options(joinedload(ChatMessage.user).joinedload(User.team))
        .filter(ChatMessage.channel_id == channel.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


def post_channel_message(db: Session, *, channel_id: int, current_user: User, message: str):
    channel = _base_channel_query(db).filter(ChatChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    ensure_chat_scope(current_user, channel)
    item = ChatMessage(channel_id=channel.id, user_id=current_user.id, message=message)
    db.add(item)
    db.flush()
    memberships = db.query(ChatMembership).filter(ChatMembership.channel_id == channel.id).all()
    for membership in memberships:
        if membership.user_id != current_user.id:
            membership.unread_count += 1
            db.add(membership)
    for mentioned_user in _resolve_mentions(db, task=Task(organization_id=channel.organization_id), content=message):
        if mentioned_user.organization_id != channel.organization_id or mentioned_user.id == current_user.id:
            continue
        create_notification(
            db,
            title="Mentioned in chat",
            message=f"{current_user.full_name} mentioned you in #{channel.name}",
            organization_id=channel.organization_id,
            type_="chat_mention",
            severity="medium",
            user_id=mentioned_user.id,
        )
    log_audit_event(db, organization_id=channel.organization_id, user_id=current_user.id, action="chat_message_sent", entity_type="ChatMessage", entity_id=item.id, details=channel.name)
    db.commit()
    item = db.query(ChatMessage).options(joinedload(ChatMessage.user).joinedload(User.team)).filter(ChatMessage.id == item.id).first()
    publish_event(
        "chat_message_created",
        {
            "channel_id": channel.id,
            "channel_name": channel.name,
            "message": item.message,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "user": {"id": current_user.id, "full_name": current_user.full_name},
        },
        organization_id=channel.organization_id,
    )
    return item


def get_task_thread(db: Session, *, task_id: int, current_user: User):
    task = get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_view_task(current_user, task):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return {"task": serialize_task_snapshot(task), "messages": list_task_messages(db, task_id)}


def post_task_thread_message(db: Session, *, task_id: int, current_user: User, message: str):
    task = get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_view_task(current_user, task):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return add_task_message(db, task=task, actor=current_user, message=message)
