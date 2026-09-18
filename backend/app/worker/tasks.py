import logging

from ..database import get_session
from ..services.mail_analysis import analyze_and_store
from ..services.pop3_poller import delete_mails, extract_eml, fetch_new_mails
from ..services.system_defaults import ensure_system_defaults

logger = logging.getLogger(__name__)


async def poll_report_mailbox(ctx) -> None:
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
                )
            except Exception:
                logger.exception("Analysis of POP3 mail failed")
                continue

            processed_uids.add(uid)

    try:
        delete_mails(processed_uids)
    except Exception:
        logger.exception("Deleting analyzed POP3 mails failed")
