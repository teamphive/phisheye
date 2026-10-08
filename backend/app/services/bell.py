"""The entries of the bell in the header.

Not to be confused with notifications.py, that one sends mails. Every function
here only adds rows to the session, the caller commits them together with
whatever caused them, so an entry never exists without its cause.
"""

from datetime import datetime, timedelta

from sqlalchemy import delete
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.mail_analysis import MailAnalysis
from ..models.notification import Notification
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User

# GET /notifications shows nothing older, the cleanup deletes it
KEEP_DAYS = 14

_VERDICT_LABELS = {
    "phishing": "Phishing",
    "suspicious": "Verdächtig",
    "clean": "Sauber",
}


async def analysis_recipients(analysis: MailAnalysis, db: AsyncSession) -> list[int]:
    """Who hears that an analysis is done.

    The assigned person, for an upload that is the uploader. A report nobody
    has taken on goes to every admin and analyst of the team, the bell is what
    makes someone pick it up. Audit only reads and gets nothing.
    """
    if analysis.handled_by is not None:
        return [analysis.handled_by]

    result = await db.exec(
        select(TeamMembership.user_id)
        .where(TeamMembership.team_id == analysis.team_id)
        .where(TeamMembership.role.in_(("admin", "analyst")))
    )
    return list(result.all())


def _quoted(subject: str) -> str:
    return f"„{subject or '(ohne Betreff)'}“"


async def notify_analysis_done(analysis: MailAnalysis, db: AsyncSession) -> None:
    verdict = analysis.verdict or "clean"
    score = round(analysis.confidence_score or 0)

    for user_id in await analysis_recipients(analysis, db):
        db.add(
            Notification(
                user_id=user_id,
                kind="analysis",
                tone=verdict,
                title=f"Analyse abgeschlossen: {_VERDICT_LABELS[verdict]} ({score} %)",
                detail=_quoted(analysis.subject),
                target=f"/analysen/{analysis.id}",
            )
        )


async def notify_analysis_failed(analysis: MailAnalysis, db: AsyncSession) -> None:
    """After the last try only, the tries before can still succeed."""
    for user_id in await analysis_recipients(analysis, db):
        db.add(
            Notification(
                user_id=user_id,
                kind="analysis",
                # red like phishing, something needs doing
                tone="phishing",
                title="Analyse fehlgeschlagen",
                detail=_quoted(analysis.subject),
                target=f"/analysen/{analysis.id}",
            )
        )


async def notify_joined(
    team: Team, member: User, inviter: User | None, db: AsyncSession
) -> None:
    """An accepted invitation: one entry for the new member, one for the rest."""
    by = inviter.name if inviter else "Jemand"
    db.add(
        Notification(
            user_id=member.id,
            kind="team",
            tone="info",
            title=f"{by} hat dich zum Team {team.name} hinzugefügt",
            detail="Du siehst jetzt die Analysen dieses Teams",
            target="/team",
        )
    )

    result = await db.exec(
        select(TeamMembership.user_id)
        .where(TeamMembership.team_id == team.id)
        .where(TeamMembership.user_id != member.id)
    )
    for user_id in result.all():
        db.add(
            Notification(
                user_id=user_id,
                kind="team",
                tone="info",
                title=f"{member.name} ist dem Team {team.name} beigetreten",
                detail=member.email,
                target="/team",
            )
        )


def oldest_kept() -> datetime:
    return datetime.utcnow() - timedelta(days=KEEP_DAYS)


async def delete_old(db: AsyncSession) -> int:
    """Deletes everything older than 14 days, read or not."""
    async with db.begin():
        # execute, not exec: SQLModel's exec only takes SELECT
        result = await db.execute(
            delete(Notification).where(Notification.created_at < oldest_kept())
        )

    return result.rowcount
