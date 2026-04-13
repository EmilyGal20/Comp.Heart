from __future__ import annotations

from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.ai import AIConversation, AIMessage
from app.models.knowledge import KnowledgeItem
from app.models.user import User
from app.services.knowledge_service import search_knowledge


def _create_or_get_conversation(db: Session, conversation_id: int | None, user: User, first_message: str) -> AIConversation:
    if conversation_id:
        conversation = (
            db.query(AIConversation)
            .options(joinedload(AIConversation.messages))
            .filter(AIConversation.id == conversation_id, AIConversation.organization_id == user.organization_id)
            .first()
        )
        if conversation:
            return conversation

    conversation = AIConversation(title=first_message[:60], user_id=user.id, organization_id=user.organization_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def _compose_mock_answer(question: str, references: list[KnowledgeItem], user: User) -> str:
    if not references:
        return (
            f"I could not find a direct {user.organization.name} document for that question yet. "
            "Try asking about onboarding, incident response, release operations, SLA workflows, or team operating processes."
        )

    bullets = []
    for item in references[:3]:
        bullets.append(f"{item.title}: {item.summary}")

    process_hint = ""
    if any(item.category.lower() == "process" for item in references):
        process_hint = " Recommended next step: follow the process document owner path and confirm the latest approval state."

    role_hint = {
        "USER": " Focus on the next action you personally own.",
        "MANAGER": " Suggested manager move: review team blockers and reassign any at-risk work.",
        "ADMIN": " Suggested admin move: review workflow bottlenecks, ownership clarity, and automation coverage.",
        "SUPER_ADMIN": " Suggested system move: compare organization readiness and standardize the strongest process pattern.",
    }.get(user.role, "")

    return f"Within {user.organization.name}, here is the best answer to '{question}': " + " ".join(bullets) + process_hint + role_hint


def _maybe_openai_answer(question: str, references: list[KnowledgeItem], user: User) -> tuple[str, bool]:
    settings = get_settings()
    if not settings.openai_api_key:
        return _compose_mock_answer(question, references, user), False

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        reference_block = "\n\n".join(
            [f"{item.title} ({item.category})\nSummary: {item.summary}\nContent: {item.content[:1200]}" for item in references[:4]]
        )
        response = client.responses.create(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": f"You are CompHeart AI for {user.organization.name}. Tailor the answer to the user's role {user.role}. Answer only from provided company context and say when context is missing.",
                },
                {
                    "role": "user",
                    "content": f"Question: {question}\n\nCompany context:\n{reference_block}",
                },
            ],
        )
        return response.output_text, True
    except Exception:
        return _compose_mock_answer(question, references, user), False


def chat(db: Session, *, message: str, conversation_id: int | None, user: User):
    conversation = _create_or_get_conversation(db, conversation_id, user, message)
    db.add(AIMessage(conversation_id=conversation.id, role="user", content=message))

    references = search_knowledge(db, organization_id=user.organization_id, query=message)[:4]
    answer, used_openai = _maybe_openai_answer(message, references, user)
    db.add(AIMessage(conversation_id=conversation.id, role="assistant", content=answer))
    db.commit()
    db.refresh(conversation)
    return conversation, answer, references, used_openai
