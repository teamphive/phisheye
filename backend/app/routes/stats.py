from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.team_membership import TeamMembership
from ..services.stats import period_stats, to_utc
from ..services.teams import get_active_membership

router = APIRouter(tags=["stats"])

# The page asks for 7 or 30 days. The cap keeps a typo from loading years
MAX_DAYS = 366
OPEN_ITEMS = 5


def _finished(team_id: int):
    """What the overview counts: completed, not deleted, of the active team.

    Running and failed analyses have no result to count.
    """
    return (
        select(MailAnalysis)
        .where(MailAnalysis.team_id == team_id)
        .where(MailAnalysis.status == "completed")
        .where(MailAnalysis.deleted_at.is_(None))
    )


async def _created_between(
    team_id: int, start: datetime, end: datetime, db: AsyncSession
) -> list[MailAnalysis]:
    result = await db.exec(
        _finished(team_id)
        .where(MailAnalysis.created_at >= start)
        .where(MailAnalysis.created_at < end)
    )
    return list(result.all())


def _open_item(analysis: MailAnalysis) -> dict:
    return {
        "id": analysis.id,
        "subject": analysis.subject,
        "sender": analysis.sender,
        "status": analysis.status,
        "verdict": analysis.verdict,
        "score": analysis.confidence_score,
        "received_at": analysis.created_at,
    }


@router.get("/stats")
async def get_stats(
    start: datetime = Query(alias="from"),
    end: datetime = Query(alias="to"),
    tz: str = Query(),
    # every role, audit included
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Numbers of the active team for the overview page.

    The browser sends the period ready made, from its midnight to now, and its
    time zone. The days of `daily` are cut in that zone, not at UTC midnight.
    """
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Unknown time zone") from exc

    start, end = to_utc(start), to_utc(end)

    if start >= end:
        raise HTTPException(status_code=422, detail="from must be before to")

    if end - start > timedelta(days=MAX_DAYS):
        raise HTTPException(status_code=422, detail="Period is too long")

    team_id = membership.team_id
    current = await _created_between(team_id, start, end, db)
    # the same span right before, for the trend
    previous = await _created_between(team_id, start - (end - start), start, db)

    # Open does not depend on the period, nothing undecided may drop out of view
    undecided = _finished(team_id).where(MailAnalysis.decided_verdict.is_(None))
    total = await db.exec(select(func.count()).select_from(undecided.subquery()))
    newest = await db.exec(
        undecided.order_by(MailAnalysis.created_at.desc()).limit(OPEN_ITEMS)
    )

    return {
        **period_stats(current, previous, start, end, zone),
        "open": {
            "total": total.one(),
            "items": [_open_item(analysis) for analysis in newest.all()],
        },
    }
