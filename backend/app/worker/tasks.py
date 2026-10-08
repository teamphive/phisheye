import asyncio
import logging
import smtplib
from datetime import datetime, timedelta

import httpx
from arq import Retry
from sqlalchemy import func
from sqlmodel import select

from ..constants import MAX_ANALYSIS_TRIES
from ..database import get_session
from ..models.mail_analysis import MailAnalysis
from ..models.team import Team
from ..models.team_invitation import TeamInvitation
from ..models.user import User
from ..services.domains import team_for_address
from ..services.eml_validation import InvalidEmlError
from ..services.invitations import deliver_invitation
from ..services.keycloak_admin import KeycloakAdminError
from ..services.mail_analysis import record_failure, run_analysis, submit_analysis
from ..services.notifications import is_notifiable, send_analysis_mail
from ..services.pop3_poller import (
    delete_mails,
    extract_eml,
    extract_reporter,
    fetch_new_mails,
)
from ..services.system_defaults import ensure_system_defaults

logger = logging.getLogger(__name__)

MAX_MAILS_PER_HOUR = 10
POLL_LOCK_KEY = "lock:poll_report_mailbox"


async def poll_report_mailbox(ctx) -> None:
    # a run must not overlap the next one, mails stay in the mailbox until done
    if not await ctx["redis"].set(POLL_LOCK_KEY, 1, nx=True, ex=120):
        return

    try:
        await _poll_report_mailbox()
    finally:
        await ctx["redis"].delete(POLL_LOCK_KEY)


async def _poll_report_mailbox() -> None:
    try:
        mails = fetch_new_mails()
    except Exception:
        logger.exception("POP3 mailbox fetch failed")
        return

    if not mails:
        return

    processed_uids: set[str] = set()

    async for db in get_session():
        default_team, system_user = await ensure_system_defaults(db)

        # a failed mail rolls the session back and expires these objects, so
        # the loop keeps only their ids
        default_team_id = default_team.id
        system_user_id = system_user.id

        for uid, raw_mail in mails:
            content = extract_eml(raw_mail)
            reporter = extract_reporter(raw_mail)

            try:
                # the team that owns the reporter's domain, otherwise the default
                team_id = await team_for_address(reporter, db) or default_team_id

                await submit_analysis(
                    content=content,
                    team_id=team_id,
                    submitted_by=system_user_id,
                    db=db,
                    reported_by=reporter,
                )
            except InvalidEmlError as error:
                # it would fail the same way on every run, so it goes
                logger.warning("POP3 mail %s dropped: %s", uid, error.detail)
            except Exception:
                logger.exception("Analysis of POP3 mail failed")
                continue

            processed_uids.add(uid)

    try:
        delete_mails(processed_uids)
    except Exception:
        logger.exception("Deleting analyzed POP3 mails failed")


async def analyze_mail(ctx, analysis_id: int) -> None:
    attempt = ctx["job_try"]

    async for db in get_session():
        try:
            await run_analysis(analysis_id, db)
        except Exception as exc:
            logger.exception("Analysis %s failed in try %s", analysis_id, attempt)
            await record_failure(analysis_id, exc, attempt, MAX_ANALYSIS_TRIES, db)

            # arq only tries again on Retry, any other exception ends the job
            if attempt < MAX_ANALYSIS_TRIES:
                raise Retry(defer=attempt * 30) from exc

            return

        await _queue_result_mail(ctx, analysis_id, db)


async def _queue_result_mail(ctx, analysis_id: int, db) -> None:
    """The reporter hears back once the analysis is done, never before."""
    analysis = await db.get(MailAnalysis, analysis_id)

    if analysis is None or analysis.status != "completed" or not analysis.reported_by:
        return

    try:
        # fixed job id: arq ignores a second enqueue for the same analysis
        await ctx["redis"].enqueue_job(
            "send_analysis_ready",
            analysis_id,
            _job_id=f"analysis-ready-{analysis_id}",
        )
    except Exception:
        logger.exception("Could not queue the result mail for analysis %s", analysis_id)


async def send_analysis_ready(ctx, analysis_id: int) -> None:
    async for db in get_session():
        analysis = await db.get(MailAnalysis, analysis_id)

        if analysis is None or analysis.notified_at is not None:
            return

        # the mail carries the verdict, an unfinished analysis has none yet
        if analysis.status != "completed":
            return

        recipient = analysis.reported_by

        if not recipient or not is_notifiable(recipient):
            return

        # the reporter address comes from a foreign mail, cap what one address gets
        recent = await db.exec(
            select(func.count())
            .select_from(MailAnalysis)
            .where(MailAnalysis.reported_by == recipient)
            .where(MailAnalysis.notified_at > datetime.utcnow() - timedelta(hours=1))
        )

        if recent.one() >= MAX_MAILS_PER_HOUR:
            logger.warning("Notification limit reached for %s", recipient)
            return

        try:
            await asyncio.to_thread(send_analysis_mail, recipient, analysis)
        except (smtplib.SMTPException, OSError) as exc:
            logger.exception("Notification for analysis %s failed", analysis_id)
            raise Retry(defer=ctx["job_try"] * 60) from exc

        analysis.notified_at = datetime.utcnow()
        await db.commit()


async def send_team_invitation(ctx, invitation_id: int) -> None:
    async for db in get_session():
        invitation = await db.get(TeamInvitation, invitation_id)

        # revoked or accepted before the job ran
        if invitation is None:
            return

        team = await db.get(Team, invitation.team_id)
        inviter = await db.get(User, invitation.invited_by)

        if team is None or team.deleted_at is not None or inviter is None:
            return

        try:
            await deliver_invitation(
                invitation.email, team.name, inviter.name, invitation.role
            )
        except (
            smtplib.SMTPException,
            OSError,
            httpx.HTTPError,
            KeycloakAdminError,
        ) as exc:
            logger.exception("Invitation %s failed", invitation_id)
            raise Retry(defer=ctx["job_try"] * 60) from exc
