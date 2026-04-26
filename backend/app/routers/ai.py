from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.ai import AIConversation
from app.models.user import User
from app.schemas.ai import (
    AIChatRequest,
    AIChatResponse,
    AIConversationRead,
    AISubtaskGenerationRequest,
    AITaskGenerationRequest,
    AITaskGenerationResponse,
)
from app.services.ai_service import chat, generate_subtasks, generate_tasks, suggest_task_plan
from app.services.task_service import get_task_by_id, can_view_task
from app.core.permissions import ROLE_SUPER_ADMIN
from app.utils.dependencies import get_current_user, resolve_org_scope


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=AIChatResponse)
def chat_with_ai(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_kw = None
    if current_user.role == ROLE_SUPER_ADMIN and payload.organization_id is not None:
        org_kw = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    conversation, answer, references, used_openai = chat(
        db,
        message=payload.message,
        conversation_id=payload.conversation_id,
        user=current_user,
        organization_id=org_kw,
    )
    return {
        "conversation_id": conversation.id,
        "answer": answer,
        "references": [
            {"id": item.id, "title": item.title, "category": item.category, "summary": item.summary}
            for item in references
        ],
        "used_openai": used_openai,
    }


@router.get("/conversations", response_model=list[AIConversationRead])
def list_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(AIConversation).options(joinedload(AIConversation.messages))
    if current_user.role != "SUPER_ADMIN":
        query = query.filter(AIConversation.organization_id == current_user.organization_id)
    return query.order_by(AIConversation.created_at.desc()).all()


@router.get("/conversations/{conversation_id}", response_model=AIConversationRead)
def get_conversation(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conversation = (
        db.query(AIConversation)
        .options(joinedload(AIConversation.messages))
        .filter(AIConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.role != "SUPER_ADMIN" and conversation.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return conversation


@router.post("/generate-tasks", response_model=AITaskGenerationResponse)
def ai_generate_tasks(
    payload: AITaskGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "SUPER_ADMIN" and payload.organization_id and payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    suggestions, used_openai = generate_tasks(db, prompt=payload.prompt, user=current_user, count=payload.task_count)
    return {
        "suggestions": suggestions,
        "used_openai": used_openai,
        "summary": f"Generated {len(suggestions)} task suggestions from the prompt.",
    }


@router.post("/generate-subtasks", response_model=AITaskGenerationResponse)
def ai_generate_subtasks(
    payload: AISubtaskGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task_by_id(db, payload.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_view_task(current_user, task):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    suggestions, used_openai = generate_subtasks(db, task=task, user=current_user, count=payload.task_count)
    return {
        "suggestions": suggestions,
        "used_openai": used_openai,
        "summary": f"Generated {len(suggestions)} subtask suggestions for {task.title}.",
    }


@router.post("/suggest-task-plan", response_model=AITaskGenerationResponse)
def ai_suggest_task_plan(
    payload: AITaskGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    suggestions, used_openai, summary = suggest_task_plan(db, prompt=payload.prompt, user=current_user)
    return {
        "suggestions": suggestions,
        "used_openai": used_openai,
        "summary": summary,
    }
