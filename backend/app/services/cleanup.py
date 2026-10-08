"""The hard delete of analyses, 10 days after they were soft deleted.

Teams are never deleted for good, they stay soft deleted.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import delete
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment
from ..models.mail_link import MailLink
from ..models.notification import Notification
from .object_storage import ObjectStorageError, delete_object

logger = logging.getLogger(__name__)

# Until then an admin can still ask for a deleted analysis to come back
KEEP_DELETED_DAYS = 10


async def purge_deleted_analyses(db: AsyncSession) -> int:
    """Removes analyses deleted more than 10 days ago, with everything of them.

    The .eml goes first. If MinIO fails, the rows stay and the next run tries
    again, so no file is left without its analysis. Deleting a file that is
    already gone succeeds in S3, a second try does no harm.
    """
    cutoff = datetime.utcnow() - timedelta(days=KEEP_DELETED_DAYS)

    async with db.begin():
        result = await db.exec(
            select(MailAnalysis.id, MailAnalysis.storage_key).where(
                MailAnalysis.deleted_at < cutoff
            )
        )
        doomed = result.all()

    purged = 0

    for analysis_id, storage_key in doomed:
        if storage_key:
            try:
                await delete_object(storage_key)
            except ObjectStorageError:
                logger.warning(
                    "Keeping analysis %s, its .eml is not deleted", analysis_id
                )
                continue

        # one transaction per analysis, a broken one does not stop the others
        async with db.begin():
            await db.execute(
                delete(MailAttachment).where(
                    MailAttachment.mail_analysis_id == analysis_id
                )
            )
            await db.execute(
                delete(MailLink).where(MailLink.mail_analysis_id == analysis_id)
            )
            # bell entries only point to it by their link
            await db.execute(
                delete(Notification).where(
                    Notification.target == f"/analysen/{analysis_id}"
                )
            )
            await db.execute(delete(MailAnalysis).where(MailAnalysis.id == analysis_id))

        purged += 1

    return purged
