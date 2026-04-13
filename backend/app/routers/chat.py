from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.collaboration import ChatChannelCreate, ChatChannelRead, ChatMessageCreate, ChatMessageRead
from app.schemas.work_management import TaskMessageRead
from app.services.chat_service import create_channel, get_channel_messages, get_task_thread, list_channels, post_channel_message
from app.utils.dependencies import get_current_user, resolve_org_scope


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/channels", response_model=list[ChatChannelRead])
def get_channels(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return list_channels(db, current_user=current_user, organization_id=scoped_org_id)


@router.post("/channels", response_model=ChatChannelRead)
def post_channel(
    payload: ChatChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization_id = current_user.organization_id
    return create_channel(db, current_user=current_user, organization_id=organization_id, payload=payload)


@router.get("/channels/{channel_id}/messages", response_model=list[ChatMessageRead])
def get_messages(channel_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_channel_messages(db, channel_id=channel_id, current_user=current_user)


@router.post("/channels/{channel_id}/messages", response_model=ChatMessageRead)
def post_message(
    channel_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return post_channel_message(db, channel_id=channel_id, current_user=current_user, message=payload.message)


@router.get("/task/{task_id}/thread")
def get_task_thread_messages(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_task_thread(db, task_id=task_id, current_user=current_user)
