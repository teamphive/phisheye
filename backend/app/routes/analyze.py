from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services.auth import get_current_user
from ..services.mail_analysis import analyze_and_store
from ..services.teams import get_active_membership

router = APIRouter(tags=["analyses"])


# helper to turn analysis into a list item
def _list_item(analysis: MailAnalysis) -> dict:
    return {
        "id": analysis.id,
        "subject": analysis.subject,
        "sender": analysis.sender,
        "status": analysis.status,
        "verdict": analysis.verdict,
        "score": analysis.confidence_score,
        # Taking over a report does not exist yet
        "handler": None,
        "source": "report" if analysis.reported_by else "upload",
        "reported_by": analysis.reported_by,
        "received_at": analysis.created_at,
    }


@router.get("/analyses")
async def list_analyses(
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.exec(
        select(MailAnalysis)
        .where(MailAnalysis.team_id == membership.team_id)
        .order_by(MailAnalysis.created_at.desc())
    )

    return [_list_item(analysis) for analysis in result.all()]


@router.post("/analyses")
async def create_analysis(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    # audit may only read
    if membership.role not in ("admin", "analyst"):
        raise HTTPException(status_code=403, detail="Your role cannot upload")

    content = await file.read()

    analysis, _ = await analyze_and_store(
        content=content,
        team_id=membership.team_id,
        submitted_by=user.id,
        db=db,
    )

    return _list_item(analysis)


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: int,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.get(MailAnalysis, analysis_id)

    # Another team's analysis looks exactly like a missing one
    if analysis is None or analysis.team_id != membership.team_id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    statement = (
        select(MailAttachment)
        .where(MailAttachment.mail_analysis_id == analysis_id)
        .order_by(MailAttachment.id)
    )
    result = await db.exec(statement)
    attachments = result.all()

    return {
        "id": analysis.id,
        "subject": analysis.subject,
        "sender": analysis.sender,
        "status": analysis.status,
        "storage_key": analysis.storage_key,
        "verdict": analysis.verdict,
        "confidence_score": analysis.confidence_score,
        "created_at": analysis.created_at,
        "attachments": [
            {
                "id": attachment.id,
                "filename": attachment.filename,
                "sha256": attachment.sha256,
                "mime_type": attachment.mime_type,
                "vt_results": attachment.vt_results,
            }
            for attachment in attachments
        ],
    }
