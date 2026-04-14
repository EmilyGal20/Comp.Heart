from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import ROLE_MANAGER
from app.db.session import get_db
from app.models.knowledge import KnowledgeItem
from app.models.user import User
from app.models.productivity import KnowledgeVersion
from app.schemas.knowledge import KnowledgeCreate, KnowledgeRead, KnowledgeUpdate
from app.schemas.productivity import KnowledgeVersionRead
from app.services.knowledge_service import create_knowledge_item, search_knowledge
from app.services.productivity_service import list_knowledge_versions, restore_knowledge_version, update_knowledge_item
from app.utils.dependencies import get_current_user, require_min_role, resolve_org_scope
from app.utils.pagination import paginate_list


router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("")
def list_knowledge(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    organization_id: int | None = Query(default=None),
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scoped_org_id = resolve_org_scope(organization_id, current_user, db)
    items = search_knowledge(db, organization_id=scoped_org_id, query=search, category=category)
    return paginate_list(items, page=page, page_size=page_size) if paginated else items


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
    item.current_version = db.query(KnowledgeVersion).filter(KnowledgeVersion.knowledge_item_id == item.id).count() + 1
    return item


@router.put("/{item_id}", response_model=KnowledgeRead)
def update_item(
    item_id: int,
    payload: KnowledgeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_MANAGER)),
):
    item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    if current_user.role != "SUPER_ADMIN" and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return update_knowledge_item(db, item=item, payload=payload, actor=current_user)


@router.get("/{item_id}/versions", response_model=list[KnowledgeVersionRead])
def get_versions(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    if current_user.role != "SUPER_ADMIN" and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return list_knowledge_versions(db, item_id=item_id)


@router.post("/{item_id}/restore-version/{version_id}", response_model=KnowledgeRead)
def restore_version(
    item_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_min_role(ROLE_MANAGER)),
):
    item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    version = db.query(KnowledgeVersion).filter(KnowledgeVersion.id == version_id, KnowledgeVersion.knowledge_item_id == item_id).first()
    if not item or not version:
        raise HTTPException(status_code=404, detail="Knowledge version not found")
    if current_user.role != "SUPER_ADMIN" and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return restore_knowledge_version(db, item=item, version=version, actor=current_user)
