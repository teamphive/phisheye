import asyncio
import logging
import smtplib
from datetime import datetime, timedelta

from arq import Retry
from sqlalchemy import func
from sqlmodel import select

from ..database import get_session
from ..models.mail_analysis import MailAnalysis
from ..services.mail_analysis import analyze_and_store
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

        for uid, raw_mail in mails:
            content = extract_eml(raw_mail)

            try:
                await analyze_and_store(
                    content=content,
                    team_id=default_team.id,
                    submitted_by=system_user.id,
                    db=db,
                    reported_by=extract_reporter(raw_mail),
                )
            except Exception:
                logger.exception("Analysis of POP3 mail failed")
                continue

            processed_uids.add(uid)

    try:
        delete_mails(processed_uids)
    except Exception:
        logger.exception("Deleting analyzed POP3 mails failed")


async def send_analysis_ready(ctx, analysis_id: int) -> None:
    async for db in get_session():
        analysis = await db.get(MailAnalysis, analysis_id)

        if analysis is None or analysis.notified_at is not None:
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
