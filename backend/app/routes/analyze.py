from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..constants import VERDICT_THRESHOLDS
from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services.auth import get_current_user
from ..services.mail_analysis import analyze_and_store
from ..services.teams import get_active_membership, require_role

router = APIRouter(tags=["analyses"])

# The frontend only knows running, completed and failed
_FRONTEND_STATUS = {"pending": "running", "processing": "running"}


# only phishing and clean are accepted by pydantic
class DecisionRequest(BaseModel):
    verdict: Literal["phishing", "clean"]


# helper to turn analysis into a list item
def _list_item(analysis: MailAnalysis) -> dict:
    return {
        "id": analysis.id,
        "subject": analysis.subject,
        "sender": analysis.sender,
        "status": _FRONTEND_STATUS.get(analysis.status, analysis.status),
        "verdict": analysis.verdict,
        "score": analysis.confidence_score,
        # Taking over a report does not exist yet
        "handler": None,
        "source": "report" if analysis.reported_by else "upload",
        "reported_by": analysis.reported_by,
        "received_at": analysis.created_at,
    }


def _attachment(attachment: MailAttachment) -> dict:
    # One entry per virus scanner, empty if VirusTotal never saw the file
    scanners = attachment.vt_results or {}
    flagged = sum(
        1 for result in scanners.values() if result.get("category") == "malicious"
    )

    return {
        "filename": attachment.filename,
        "size": attachment.size,
        "sha256": attachment.sha256,
        "virus_total": f"{flagged} / {len(scanners)}" if scanners else "unbekannt",
        "malicious": flagged > 0,
    }


async def _decision(analysis: MailAnalysis, db: AsyncSession) -> dict | None:
    if analysis.decided_verdict is None:
        return None

    decider = await db.get(User, analysis.decided_by)

    return {
        "verdict": analysis.decided_verdict,
        "by": decider.name,
        "at": analysis.decided_at,
    }


async def _team_analysis(
    analysis_id: int, membership: TeamMembership, db: AsyncSession
) -> MailAnalysis:
    """The analysis if the active team may see it, otherwise 404.

    Another team's analysis and a deleted one look exactly like a missing one.
    """
    analysis = await db.get(MailAnalysis, analysis_id)

    if (
        analysis is None
        or analysis.team_id != membership.team_id
        or analysis.deleted_at is not None
    ):
        raise HTTPException(status_code=404, detail="Analysis not found")

    return analysis


@router.get("/analyses")
async def list_analyses(
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.exec(
        select(MailAnalysis)
        .where(MailAnalysis.team_id == membership.team_id)
        .where(MailAnalysis.deleted_at.is_(None))
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
    require_role(membership, "admin", "analyst")

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
    analysis = await _team_analysis(analysis_id, membership, db)

    result = await db.exec(
        select(MailAttachment)
        .where(MailAttachment.mail_analysis_id == analysis_id)
        .order_by(MailAttachment.id)
    )
    attachments = result.all()

    return {
        **_list_item(analysis),
        "thresholds": VERDICT_THRESHOLDS,
        # The detection does not produce criteria and links yet
        "criteria": [],
        "criteria_total": 0,
        "links": [],
        "attachments": [_attachment(attachment) for attachment in attachments],
        "raw_headers": analysis.raw_headers or "",
        "decision": await _decision(analysis, db),
        # The analysis runs during the upload, so there is no progress to show
        "duration_seconds": None,
        "step": None,
        "started_at": None,
        "error": None,
        "storage_key": analysis.storage_key,
    }


@router.post("/analyses/{analysis_id}/decision")
async def decide(
    analysis_id: int,
    payload: DecisionRequest,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin", "analyst")

    async with db.begin():
        analysis = await _team_analysis(analysis_id, membership, db)
        analysis.decided_verdict = payload.verdict
        analysis.decided_by = user.id
        analysis.decided_at = datetime.utcnow()
        db.add(analysis)

    return {
        "verdict": analysis.decided_verdict,
        "by": user.name,
        "at": analysis.decided_at,
    }


@router.delete("/analyses/{analysis_id}/decision", status_code=204)
async def revoke_decision(
    analysis_id: int,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin", "analyst")

    async with db.begin():
        analysis = await _team_analysis(analysis_id, membership, db)
        analysis.decided_verdict = None
        analysis.decided_by = None
        analysis.decided_at = None
        db.add(analysis)


@router.delete("/analyses/{analysis_id}", status_code=204)
async def delete_analysis(
    analysis_id: int,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        analysis = await _team_analysis(analysis_id, membership, db)
        analysis.deleted_at = datetime.utcnow()
        db.add(analysis)
