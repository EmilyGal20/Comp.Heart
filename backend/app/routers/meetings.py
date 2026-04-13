from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.productivity import MeetingSummary
from app.schemas.productivity import MeetingSummaryCreate, MeetingSummaryRead
from app.services.productivity_service import create_tasks_from_meeting, list_meetings, summarize_meeting_notes
from app.utils.dependencies import get_current_user, resolve_org_scope


router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("", response_model=list[MeetingSummaryRead])
def get_meetings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return list_meetings(db, current_user=current_user)


@router.post("/summarize", response_model=MeetingSummaryRead)
def summarize_meeting(
    payload: MeetingSummaryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    org_id = resolve_org_scope(payload.organization_id, current_user, db, allow_global=False)
    return summarize_meeting_notes(db, payload=payload, actor=current_user, organization_id=org_id)


@router.get("/{meeting_id}", response_model=MeetingSummaryRead)
def get_meeting(meeting_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    meeting = db.query(MeetingSummary).filter(MeetingSummary.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting summary not found")
    if current_user.role != "SUPER_ADMIN" and meeting.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    return meeting


@router.post("/{meeting_id}/tasks")
def create_tasks(meeting_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    meeting = db.query(MeetingSummary).filter(MeetingSummary.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting summary not found")
    if current_user.role != "SUPER_ADMIN" and meeting.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access denied")
    tasks = create_tasks_from_meeting(db, meeting=meeting, actor=current_user)
    return {"created": len(tasks)}
