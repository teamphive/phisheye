from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, or_, update
from sqlalchemy.orm import aliased
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..constants import VERDICT_THRESHOLDS, WORKER_MAX_JOBS
from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment
from ..models.mail_link import MailLink
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services import eml_validation
from ..services.auth import get_current_user
from ..services.mail_analysis import submit_analysis
from ..services.notifications import enqueue_decision_mail
from ..services.object_storage import ObjectStorageError, load_eml
from ..services.teams import get_active_membership, require_role

router = APIRouter(tags=["analyses"])

# The frontend only knows running, completed and failed
_FRONTEND_STATUS = {"pending": "running", "processing": "running"}

# Same limits as the frontend's search: hashes only from 8 characters on,
# shorter is guessing, and at most 20 hits
_HASH_PREFIX_LENGTH = 8
_SEARCH_LIMIT = 20


# only phishing and clean are accepted by pydantic
class DecisionRequest(BaseModel):
    verdict: Literal["phishing", "clean"]


def _decision_item(analysis: MailAnalysis, decider: str | None) -> dict | None:
    """What an analyst decided, null while nobody has. `by` is the name."""
    if analysis.decided_verdict is None:
        return None

    return {
        "verdict": analysis.decided_verdict,
        "by": decider,
        "at": analysis.decided_at,
    }


# helper to turn analysis into a list item. handler and decider are names,
# `mine` says whether the analysis is assigned to the caller, so the frontend
# does not have to compare names (two people can be called the same)
def _list_item(
    analysis: MailAnalysis,
    handler: str | None,
    decider: str | None,
    user_id: int,
) -> dict:
    return {
        "id": analysis.id,
        "subject": analysis.subject,
        "sender": analysis.sender,
        "status": _FRONTEND_STATUS.get(analysis.status, analysis.status),
        "verdict": analysis.verdict,
        "score": analysis.confidence_score,
        "handler": handler,
        "mine": analysis.handled_by is not None and analysis.handled_by == user_id,
        "decision": _decision_item(analysis, decider),
        "source": "report" if analysis.reported_by else "upload",
        "reported_by": analysis.reported_by,
        "received_at": analysis.created_at,
    }


def _search_hit(
    analysis: MailAnalysis,
    handler: str | None,
    decider: str | None,
    user_id: int,
    needle: str,
    matching_hash: str | None,
) -> dict:
    """One hit per analysis, the most specific field wins: hash, sender, subject.

    Link hosts belong between sender and subject, but links are not stored yet.
    """
    if matching_hash:
        field, match = "hash", matching_hash
    elif needle in analysis.sender.lower():
        field, match = "sender", analysis.sender
    else:
        field, match = "subject", analysis.subject

    return {
        **_list_item(analysis, handler, decider, user_id),
        "field": field,
        "match": match,
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


def _ai_assessment(analysis: MailAnalysis) -> dict | None:
    if analysis.ai_verdict is None:
        return None

    return {
        "verdict": analysis.ai_verdict,
        "confidence": analysis.ai_confidence,
        "model": analysis.ai_model,
    }


def _duration(analysis: MailAnalysis) -> int | None:
    if analysis.started_at is None or analysis.completed_at is None:
        return None

    return round((analysis.completed_at - analysis.started_at).total_seconds())


def _with_names():
    """Analyses with the names of the assigned and the deciding person.

    Looking them up per row would cost two queries per analysis. Outer joins,
    so analyses without anyone assigned or decided stay in with null.
    """
    handler, decider = aliased(User), aliased(User)

    return (
        select(MailAnalysis, handler.name, decider.name)
        .outerjoin(handler, handler.id == MailAnalysis.handled_by)
        .outerjoin(decider, decider.id == MailAnalysis.decided_by)
    )


async def _user_name(user_id: int | None, db: AsyncSession) -> str | None:
    if user_id is None:
        return None

    person = await db.get(User, user_id)
    return person.name if person else None


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
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.exec(
        _with_names()
        .where(MailAnalysis.team_id == membership.team_id)
        .where(MailAnalysis.deleted_at.is_(None))
        .order_by(MailAnalysis.created_at.desc())
    )

    return [
        _list_item(analysis, handler, decider, user.id)
        for analysis, handler, decider in result.all()
    ]


# Must stay above /analyses/{analysis_id}, otherwise "search" is read as an id
@router.get("/analyses/search")
async def search_analyses(
    q: str,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    needle = q.strip().lower()

    # The frontend only asks from 2 characters on
    if len(needle) < 2:
        return []

    # autoescape: a % or _ in the search text is meant literally, not as wildcard
    matches_hash = MailAttachment.sha256.startswith(needle, autoescape=True)
    searches_hashes = len(needle) >= _HASH_PREFIX_LENGTH

    conditions = [
        func.lower(MailAnalysis.subject).contains(needle, autoescape=True),
        func.lower(MailAnalysis.sender).contains(needle, autoescape=True),
    ]
    if searches_hashes:
        analyses_with_hash = select(MailAttachment.mail_analysis_id).where(matches_hash)
        conditions.append(MailAnalysis.id.in_(analyses_with_hash))

    result = await db.exec(
        _with_names()
        .where(MailAnalysis.team_id == membership.team_id)
        .where(MailAnalysis.deleted_at.is_(None))
        .where(or_(*conditions))
        .order_by(MailAnalysis.created_at.desc())
        .limit(_SEARCH_LIMIT)
    )
    rows = result.all()
    analyses = [analysis for analysis, *_ in rows]

    # The full hash for every hit found by its hash, the frontend shows it
    hashes: dict[int, str] = {}
    if searches_hashes and analyses:
        result = await db.exec(
            select(MailAttachment)
            .where(MailAttachment.mail_analysis_id.in_([a.id for a in analyses]))
            .where(matches_hash)
        )
        hashes = {a.mail_analysis_id: a.sha256 for a in result.all()}

    return [
        _search_hit(
            analysis, handler, decider, user.id, needle, hashes.get(analysis.id)
        )
        for analysis, handler, decider in rows
    ]


@router.post("/analyses")
async def create_analysis(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    # audit may only read
    require_role(membership, "admin", "analyst")

    # one byte more than the limit is enough to see that it is too large
    content = await file.read(eml_validation.MAX_EML_BYTES + 1)
    eml_validation.check_upload(file.filename, len(content))

    # Answers at once with status running, the worker analyzes in the background
    analysis = await submit_analysis(
        content=content,
        team_id=membership.team_id,
        submitted_by=user.id,
        db=db,
        # whoever uploads works on it
        handled_by=user.id,
    )

    return _list_item(analysis, user.name, None, user.id)


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
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

    result = await db.exec(
        select(MailLink)
        .where(MailLink.mail_analysis_id == analysis_id)
        .order_by(MailLink.id)
    )
    links = result.all()

    criteria = analysis.criteria or []
    running = analysis.status in ("pending", "processing")

    return {
        **_list_item(
            analysis,
            await _user_name(analysis.handled_by, db),
            await _user_name(analysis.decided_by, db),
            user.id,
        ),
        "thresholds": VERDICT_THRESHOLDS,
        "ai_assessment": _ai_assessment(analysis),
        "criteria": criteria,
        # the sum before the cap, the page shows "Summe 120, gekappt auf 100"
        "criteria_total": sum(criterion["weight"] for criterion in criteria),
        "links": [
            {
                "text": link.text,
                "target": link.target,
                "finding": link.finding,
                "tone": link.tone,
            }
            for link in links
        ],
        "attachments": [_attachment(attachment) for attachment in attachments],
        "raw_headers": analysis.raw_headers or "",
        "duration_seconds": _duration(analysis),
        # step and started_at only while it runs, error only once it failed
        "step": analysis.step if running else None,
        "started_at": analysis.started_at if running else None,
        "error": analysis.error if analysis.status == "failed" else None,
        "storage_key": analysis.storage_key,
    }


@router.get("/analyses/{analysis_id}/eml")
async def download_eml(
    analysis_id: int,
    # every role of the team, audit included, may read the original
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """The original mail as stored in MinIO, for an analyst to open by hand.

    MinIO is not reachable from outside, so the file goes through here.
    """
    analysis = await _team_analysis(analysis_id, membership, db)

    if not analysis.storage_key:
        raise HTTPException(status_code=404, detail="No stored mail for this analysis")

    try:
        content = await load_eml(analysis.storage_key)
    except ObjectStorageError as exc:
        raise HTTPException(status_code=503, detail="Mail storage unavailable") from exc

    return Response(
        content,
        # The file can contain malware: octet-stream and attachment make the
        # browser save it instead of showing or running it, nosniff keeps it
        # from guessing another type
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="phisheye-{analysis.id}.eml"',
            "X-Content-Type-Options": "nosniff",
        },
    )


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

        # One statement does the check and the write: a free analysis goes to
        # the person who decides, one assigned to someone else changes nothing.
        # Two people clicking at the same moment cannot both win, the database
        # applies the UPDATEs one after the other and the second finds the row
        # taken.
        result = await db.execute(
            update(MailAnalysis)
            .where(MailAnalysis.id == analysis.id)
            .where(
                or_(
                    MailAnalysis.handled_by.is_(None),
                    MailAnalysis.handled_by == user.id,
                )
            )
            .values(
                handled_by=user.id,
                decided_verdict=payload.verdict,
                decided_by=user.id,
                decided_at=datetime.utcnow(),
            )
        )

        if result.rowcount == 0:
            raise HTTPException(
                status_code=403, detail="Only the assigned person can decide"
            )

        # the statement bypassed the loaded object, read the new values
        await db.refresh(analysis)

    # the reporter hears of it after a pause, the job reads the state then
    if analysis.reported_by:
        await enqueue_decision_mail(analysis.id, analysis.decided_at)

    return {
        "verdict": analysis.decided_verdict,
        "by": user.name,
        "at": analysis.decided_at,
    }


@router.delete("/analyses/{analysis_id}/decision", status_code=204)
async def revoke_decision(
    analysis_id: int,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin", "analyst")

    async with db.begin():
        analysis = await _team_analysis(analysis_id, membership, db)
        _require_assigned_to(analysis, user)
        analysis.decided_verdict = None
        analysis.decided_by = None
        analysis.decided_at = None
        db.add(analysis)


def _require_assigned_to(analysis: MailAnalysis, user: User) -> None:
    """Only the person the analysis is assigned to may decide or take it back."""
    if analysis.handled_by is None:
        raise HTTPException(status_code=409, detail="Take the analysis on first")

    if analysis.handled_by != user.id:
        raise HTTPException(
            status_code=403, detail="Only the assigned person can decide"
        )


def _require_undecided(analysis: MailAnalysis) -> None:
    # after a decision the assignment is fixed until the decision is taken back
    if analysis.decided_verdict is not None:
        raise HTTPException(status_code=409, detail="Analysis is already decided")


@router.post("/analyses/{analysis_id}/assignment")
async def claim_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Takes the analysis on, also away from someone else, also a decided one.

    The frontend asks before taking one away, the backend does not. Whoever
    has the analysis is the only one who can decide it or take that back.
    """
    require_role(membership, "admin", "analyst")

    async with db.begin():
        analysis = await _team_analysis(analysis_id, membership, db)
        analysis.handled_by = user.id
        db.add(analysis)

    return {"handler": user.name}


@router.delete("/analyses/{analysis_id}/assignment", status_code=204)
async def release_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Hands one's own analysis back. Nobody has it afterwards."""
    require_role(membership, "admin", "analyst")

    async with db.begin():
        analysis = await _team_analysis(analysis_id, membership, db)
        _require_undecided(analysis)

        # taking it from someone else goes through POST
        if analysis.handled_by not in (None, user.id):
            raise HTTPException(
                status_code=403, detail="Only the assigned person can hand it back"
            )

        analysis.handled_by = None
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


@router.get("/queue")
async def get_queue(
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Waiting analyses for the progress view.

    All teams share one queue. Other teams only show up in the count, their
    subjects and senders stay hidden.
    """
    result = await db.exec(
        select(MailAnalysis)
        .where(MailAnalysis.status == "pending")
        .where(MailAnalysis.deleted_at.is_(None))
        .order_by(MailAnalysis.created_at)
    )
    waiting = result.all()

    busy = await db.exec(
        select(func.count())
        .select_from(MailAnalysis)
        .where(MailAnalysis.status == "processing")
    )

    items = []
    for position, analysis in enumerate(waiting, start=1):
        if analysis.team_id != membership.team_id:
            continue

        if analysis.reported_by:
            submitted_by = analysis.reported_by
        else:
            submitter = await db.get(User, analysis.submitted_by)
            submitted_by = submitter.name

        items.append(
            {
                "position": position,
                "subject": analysis.subject,
                "sender": analysis.sender,
                "source": "report" if analysis.reported_by else "upload",
                "submitted_by": submitted_by,
                "queued_at": analysis.created_at,
            }
        )

    return {
        "waiting": len(waiting),
        "workers_busy": busy.one(),
        "workers_total": WORKER_MAX_JOBS,
        "items": items,
    }
