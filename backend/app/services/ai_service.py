from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.ai import AIConversation, AIMessage
from app.models.knowledge import KnowledgeItem
from app.models.task import Task
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


def task_assist(*, task: Task, user: User, action: str) -> str:
    normalized = action.lower().strip()
    knowledge_hint = task.related_knowledge.title if task.related_knowledge else "No linked knowledge"
    if normalized == "summarize task":
        return (
            f"Task summary for {user.organization.name}: {task.title}. "
            f"Status: {task.status}. Priority: {task.priority}. "
            f"Owner: {task.assignee.full_name if task.assignee else 'unassigned'}. "
            f"Linked knowledge: {knowledge_hint}. "
            f"Key objective: {task.description}"
        )
    if normalized == "suggest next steps":
        return (
            f"Suggested next steps: 1. Confirm the immediate owner and expected due date. "
            f"2. Review linked knowledge ({knowledge_hint}) for process guidance. "
            f"3. Resolve blockers preventing progress toward {task.status}. "
            f"4. Post an update comment so the team sees momentum."
        )
    if normalized == "break into subtasks":
        return (
            "Suggested subtasks:\n"
            "1. Clarify scope and success criteria.\n"
            "2. Identify blockers, dependencies, and stakeholders.\n"
            "3. Execute the highest-risk work item first.\n"
            "4. Validate results and prepare a review/update note."
        )
    return "Unsupported AI task action."


def _fallback_task_suggestions(db: Session, *, prompt: str, user: User, count: int):
    references = search_knowledge(db, organization_id=user.organization_id, query=prompt)[:4]
    candidate_assignees = (
        db.query(User)
        .filter(User.organization_id == user.organization_id, User.is_active.is_(True))
        .order_by(User.role.desc(), User.full_name.asc())
        .all()
    )
    prompt_bits = [bit.strip().capitalize() for bit in prompt.replace(":", " ").split() if len(bit.strip()) > 3]
    base_label = " ".join(prompt_bits[:4]) or "Operational plan"
    templates = [
        ("Scope and alignment", "Clarify scope, owners, acceptance criteria, and stakeholder expectations."),
        ("Execution setup", "Prepare the working plan, dependencies, handoffs, and communications needed to start delivery."),
        ("Validation and rollout", "Review outcomes, capture approvals, and publish the final update path."),
        ("Follow-through", "Monitor results, collect feedback, and document operational learnings."),
    ]
    suggestions = []
    for index in range(min(max(count, 1), 6)):
        title_seed, desc_seed = templates[index % len(templates)]
        assignee = candidate_assignees[index % len(candidate_assignees)] if candidate_assignees else None
        suggestions.append(
            {
                "title": f"{base_label} - {title_seed}",
                "description": f"{desc_seed}\n\nPrompt context: {prompt}",
                "priority": "high" if index == 0 else "medium",
                "suggested_assignee_id": assignee.id if assignee else None,
                "suggested_assignee_name": assignee.full_name if assignee else None,
                "due_in_days": 2 + index * 2,
                "sla_hours": 24 if index < 2 else 48,
                "tags": ["ai-generated", "planning", *(["process"] if "process" in prompt.lower() else [])],
                "related_knowledge_ids": [item.id for item in references[:2]],
                "related_knowledge_titles": [item.title for item in references[:2]],
                "risk_level": "high" if index == 0 else "medium",
                "rationale": f"Suggested for {user.organization.name} based on the requested goal, the user's role, and the most relevant internal knowledge.",
            }
        )
    return suggestions, references


def _openai_task_suggestions(db: Session, *, prompt: str, user: User, count: int):
    settings = get_settings()
    if not settings.openai_api_key:
        return None, None
    try:
        from openai import OpenAI

        references = search_knowledge(db, organization_id=user.organization_id, query=prompt)[:4]
        assignees = (
            db.query(User)
            .filter(User.organization_id == user.organization_id, User.is_active.is_(True))
            .order_by(User.full_name.asc())
            .limit(8)
            .all()
        )
        context = "\n".join([f"- {item.title}: {item.summary}" for item in references])
        assignee_context = "\n".join([f"- {item.id}: {item.full_name} ({item.title})" for item in assignees])
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.responses.create(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You generate structured internal work plans. Return concise JSON with a top-level key "
                        "'suggestions' containing objects with title, description, priority, suggested_assignee_id, "
                        "due_in_days, sla_hours, tags, related_knowledge_titles, risk_level, rationale."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Organization: {user.organization.name}\nRole: {user.role}\nPrompt: {prompt}\n"
                        f"Task count: {count}\nKnowledge:\n{context}\nAssignees:\n{assignee_context}"
                    ),
                },
            ],
        )
        text = response.output_text.strip()
        import json

        parsed = json.loads(text)
        return parsed.get("suggestions", []), references
    except Exception:
        return None, None


def generate_tasks(db: Session, *, prompt: str, user: User, count: int = 3):
    suggestions, references = _openai_task_suggestions(db, prompt=prompt, user=user, count=count)
    used_openai = suggestions is not None
    if suggestions is None:
        suggestions, references = _fallback_task_suggestions(db, prompt=prompt, user=user, count=count)
    reference_ids = [item.id for item in references or []]
    reference_titles = [item.title for item in references or []]
    normalized = []
    for suggestion in suggestions[: max(count, 1)]:
        normalized.append(
            {
                "title": suggestion.get("title") or "AI-generated task",
                "description": suggestion.get("description") or prompt,
                "priority": (suggestion.get("priority") or "medium").lower(),
                "suggested_assignee_id": suggestion.get("suggested_assignee_id"),
                "suggested_assignee_name": suggestion.get("suggested_assignee_name"),
                "due_in_days": int(suggestion.get("due_in_days") or 3),
                "sla_hours": int(suggestion.get("sla_hours") or 24),
                "tags": suggestion.get("tags") or ["ai-generated"],
                "related_knowledge_ids": suggestion.get("related_knowledge_ids") or reference_ids[:2],
                "related_knowledge_titles": suggestion.get("related_knowledge_titles") or reference_titles[:2],
                "risk_level": suggestion.get("risk_level") or "medium",
                "rationale": suggestion.get("rationale") or "Generated from organization context and operational prompt.",
            }
        )
    return normalized, used_openai


def generate_subtasks(db: Session, *, task: Task, user: User, count: int = 4):
    suggestions, used_openai = generate_tasks(
        db,
        prompt=f"Break this task into subtasks: {task.title}. Description: {task.description}",
        user=user,
        count=count,
    )
    for item in suggestions:
        item["title"] = f"{task.title} - {item['title']}"
        item["suggested_assignee_id"] = task.assignee_id or item["suggested_assignee_id"]
        item["suggested_assignee_name"] = task.assignee.full_name if task.assignee else item["suggested_assignee_name"]
    return suggestions, used_openai


def suggest_task_plan(db: Session, *, prompt: str, user: User):
    suggestions, used_openai = generate_tasks(db, prompt=prompt, user=user, count=4)
    summary = (
        f"Generated {len(suggestions)} suggested tasks for {user.organization.name}. "
        "The plan balances scoping, execution, review, and follow-through based on the prompt and current org context."
    )
    return suggestions, used_openai, summary
