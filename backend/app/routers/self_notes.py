from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.productivity import SelfNote
from app.schemas.productivity import SelfNoteCreate, SelfNoteRead, SelfNoteUpdate
from app.services.productivity_service import create_self_note, list_self_notes, update_self_note
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/self-notes", tags=["self-notes"])


@router.get("", response_model=list[SelfNoteRead])
def get_notes(search: str | None = Query(default=None), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return list_self_notes(db, user=current_user, search=search)


@router.post("", response_model=SelfNoteRead)
def post_note(payload: SelfNoteCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return create_self_note(db, payload=payload, user=current_user)


@router.put("/{note_id}", response_model=SelfNoteRead)
def put_note(note_id: int, payload: SelfNoteUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    note = db.query(SelfNote).filter(SelfNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Self note not found")
    return update_self_note(db, note=note, payload=payload, user=current_user)


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    note = db.query(SelfNote).filter(SelfNote.id == note_id, SelfNote.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Self note not found")
    db.delete(note)
    db.commit()
    return {"deleted": True}
