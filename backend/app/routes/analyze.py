from sqlmodel import select
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment
from ..services.mail_analysis import analyze_and_store

router = APIRouter(tags=["analyses"])


@router.post("/analyze")
async def analyze_email(
    file: UploadFile = File(...),
    team_id: int = Form(...),
    submitted_by: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()

    analysis = await analyze_and_store(
        content=content,
        team_id=team_id,
        submitted_by=submitted_by,
        db=db,
    )

    return {
        "id": analysis.id,
        "subject": analysis.subject,
        "sender": analysis.sender,
        "status": analysis.status,
        "attachments": analysis.attachments_result,  # type: ignore[attr-defined]
    }


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.get(MailAnalysis, analysis_id)

    if analysis is None:
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
