from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.knowledge import KnowledgeItem, KnowledgeTag


def slugify(value: str) -> str:
    return value.strip().lower().replace(" ", "-").replace("/", "-")


def attach_tags(db: Session, tag_names: list[str]) -> list[KnowledgeTag]:
    tags: list[KnowledgeTag] = []
    for name in sorted({tag.strip().lower() for tag in tag_names if tag.strip()}):
        tag = db.query(KnowledgeTag).filter(KnowledgeTag.name == name).first()
        if not tag:
            tag = KnowledgeTag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def create_knowledge_item(db: Session, payload, organization_id: int):
    item = KnowledgeItem(
        title=payload.title,
        slug=slugify(payload.title),
        category=payload.category,
        organization_id=organization_id,
        content=payload.content,
        summary=payload.summary,
        author_id=payload.author_id,
        is_published=payload.is_published,
    )
    item.tags = attach_tags(db, payload.tag_names)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def search_knowledge(db: Session, organization_id: int | None = None, query: str | None = None, category: str | None = None):
    result = db.query(KnowledgeItem).options(joinedload(KnowledgeItem.tags), joinedload(KnowledgeItem.author))
    if organization_id is not None:
        result = result.filter(KnowledgeItem.organization_id == organization_id)
    if query:
        like = f"%{query.lower()}%"
        result = result.filter(
            or_(
                KnowledgeItem.title.ilike(like),
                KnowledgeItem.summary.ilike(like),
                KnowledgeItem.content.ilike(like),
                KnowledgeItem.category.ilike(like),
            )
        )
    if category:
        result = result.filter(KnowledgeItem.category == category)
    return result.order_by(KnowledgeItem.updated_at.desc()).all()
