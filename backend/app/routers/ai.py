from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.ai import AIConversation
from app.models.user import User
from app.schemas.ai import AIChatRequest, AIChatResponse, AIConversationRead
from app.services.ai_service import chat
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=AIChatResponse)
def chat_with_ai(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation, answer, references, used_openai = chat(
        db,
        message=payload.message,
        conversation_id=payload.conversation_id,
        user=current_user,
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
