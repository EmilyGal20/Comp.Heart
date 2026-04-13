from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_MANAGER
from app.db.session import get_db
from app.models.knowledge import KnowledgeItem
from app.models.user import User
from app.schemas.knowledge import KnowledgeCreate, KnowledgeRead
from app.services.knowledge_service import create_knowledge_item, search_knowledge
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope


router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeRead])
def list_knowledge(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    return search_knowledge(db, organization_id=scoped_org_id, query=search, category=category)


@router.get("/search")
def search_knowledge_items(
    q: str = "",
    category: str | None = None,
    organization_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    items = search_knowledge(db, organization_id=scoped_org_id, query=q, category=category)
    return {"items": items, "total": len(items)}


@router.post("", response_model=KnowledgeRead)
def create_item(
    payload: KnowledgeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_MANAGER)),
):
    scoped_org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return create_knowledge_item(db, payload, scoped_org_id)


@router.get("/{item_id}", response_model=KnowledgeRead)
def get_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = (
        db.query(KnowledgeItem)
        .options(joinedload(KnowledgeItem.organization), joinedload(KnowledgeItem.tags), joinedload(KnowledgeItem.author).joinedload(User.team))
        .filter(KnowledgeItem.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    if current_user.role != "SUPER_ADMIN" and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return item
