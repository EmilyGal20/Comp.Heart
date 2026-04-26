from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.productivity import MeetingSummary
from app.schemas.productivity import MeetingSummaryCreate, MeetingSummaryRead
from app.services.productivity_service import create_tasks_from_meeting, list_meetings, summarize_meeting_notes
from app.utils.dependencies import get_current_user, resolve_org_scope
from app.utils.pagination import paginate_list


router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("")
def get_meetings(
    paginated: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List meetings; when paginated=true returns {items, meta} with Pydantic-encoded rows so the client always gets a stable shape."""
    rows = list_meetings(db, current_user=current_user)
    if paginated:
        page_data = paginate_list(rows, page=page, page_size=page_size)
        return {
            "items": [MeetingSummaryRead.model_validate(m) for m in page_data["items"]],
            "meta": page_data["meta"],
        }
    return [MeetingSummaryRead.model_validate(m) for m in rows]


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
    meeting = (
        db.query(MeetingSummary)
        .options(joinedload(MeetingSummary.creator), joinedload(MeetingSummary.team), joinedload(MeetingSummary.organization))
        .filter(MeetingSummary.id == meeting_id)
        .first()
    )
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
