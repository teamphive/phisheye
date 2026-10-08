import hashlib
import logging
import os
from collections.abc import Mapping
from datetime import datetime
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser

import vt
from arq import create_pool
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment
from ..models.mail_link import MailLink
from . import eml_validation
from .ai_assessment import assess
from .detection import detect
from .msg_convert import is_msg, msg_to_eml
from .notifications import enqueue_analysis_ready, redis_settings
from .object_storage import ObjectStorageError, delete_object, load_eml, store_eml

logger = logging.getLogger(__name__)


def _db_text(value: str) -> str:
    """Postgres refuses NUL bytes in text, Outlook files carry them."""
    return value.replace("\x00", "")


# vt returns its own dict wrapper, which the JSON column cannot store
def _plain(value):
    if isinstance(value, Mapping):
        return {key: _plain(item) for key, item in value.items()}

    return value


def _parse(content: bytes) -> EmailMessage:
    return BytesParser(policy=policy.default).parsebytes(content)


async def submit_analysis(
    *,
    content: bytes,
    team_id: int,
    submitted_by: int,
    db: AsyncSession,
    reported_by: str | None = None,
    handled_by: int | None = None,
) -> MailAnalysis:
    """Stores the mail and queues the analysis, the worker does the rest.

    Only what the list needs is read here, so the caller gets an answer at once.
    `handled_by` is only given by the upload, reports start without anyone.
    """
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # an Outlook .msg is turned into the same bytes a .eml has, from here on
    # the analysis does not know the difference
    if is_msg(content):
        content = msg_to_eml(content)

    msg = _parse(content)
    eml_validation.check_eml(content, msg)
    storage_key = await store_eml(content)

    try:
        async with db.begin():
            analysis = MailAnalysis(
                team_id=team_id,
                submitted_by=submitted_by,
                subject=_db_text(str(msg.get("Subject", ""))),
                sender=_db_text(str(msg.get("From", ""))),
                status="pending",
                storage_key=storage_key,
                reported_by=reported_by,
                handled_by=handled_by,
                raw_headers=_db_text(
                    "\n".join(f"{key}: {value}" for key, value in msg.items())
                ),
            )
            db.add(analysis)
    except SQLAlchemyError:
        try:
            await delete_object(storage_key)
        except ObjectStorageError:
            logger.exception("Failed to remove orphaned EML object %s", storage_key)
        raise

    await enqueue_analysis(analysis.id)

    if reported_by:
        await enqueue_analysis_ready(analysis.id)

    return analysis


async def enqueue_analysis(analysis_id: int) -> None:
    """Hands the analysis to the worker.

    If Redis is down the analysis stays pending, the mail itself is safe in
    MinIO and the database.
    """
    try:
        pool = await create_pool(redis_settings())
        try:
            # fixed job id: arq ignores a second enqueue for the same analysis
            await pool.enqueue_job(
                "analyze_mail", analysis_id, _job_id=f"analysis-{analysis_id}"
            )
        finally:
            await pool.aclose()
    except Exception:
        logger.exception("Could not queue analysis %s", analysis_id)


async def _set_step(analysis: MailAnalysis, step: str, db: AsyncSession) -> None:
    # Own commit per step, the detail page polls and shows it
    async with db.begin():
        analysis.step = step
        db.add(analysis)


def _attachments_of(msg: EmailMessage) -> list[dict]:
    attachments = []

    for part in msg.iter_attachments():
        file_bytes = part.get_payload(decode=True)

        if file_bytes is None:
            continue

        attachments.append(
            {
                "filename": _db_text(part.get_filename() or "unnamed"),
                "sha256": hashlib.sha256(file_bytes).hexdigest(),
                "mime_type": _db_text(part.get_content_type()),
                "size": len(file_bytes),
            }
        )

    return attachments


async def _virus_total(client: vt.Client, sha256: str) -> dict | None:
    """The scanner results for a file, None if VirusTotal does not know it.

    A failed lookup also gives None. The attachment then shows as unknown
    instead of failing the whole analysis.
    """
    try:
        result = await client.get_object_async(f"/files/{sha256}")
    except vt.APIError as exc:
        if exc.code != "NotFoundError":
            logger.warning("VirusTotal lookup of %s failed: %s", sha256, exc.code)
        return None

    return _plain(result.last_analysis_results)


async def _check_attachments(attachments: list[dict]) -> None:
    """Adds `vt_results` to every attachment."""
    for attachment in attachments:
        attachment["vt_results"] = None

    if not attachments:
        return

    api_key = os.getenv("VT_API_KEY")

    if not api_key:
        logger.warning("VT_API_KEY is not set, attachments stay unchecked")
        return

    async with vt.Client(api_key) as client:
        for attachment in attachments:
            attachment["vt_results"] = await _virus_total(client, attachment["sha256"])


async def run_analysis(analysis_id: int, db: AsyncSession) -> None:
    """The slow part of an analysis. Runs in the worker, never in a request."""
    async with db.begin():
        analysis = await db.get(MailAnalysis, analysis_id)

        # deleted in the meantime, or done by an earlier try
        if (
            analysis is None
            or analysis.deleted_at is not None
            or analysis.status == "completed"
        ):
            return

        analysis.status = "processing"
        # a retry keeps the first start, the duration covers all tries
        analysis.started_at = analysis.started_at or datetime.utcnow()
        analysis.step = "Mail wird geladen"
        db.add(analysis)

    msg = _parse(await load_eml(analysis.storage_key))

    await _set_step(analysis, "Kriterien werden geprüft", db)
    detection = detect(msg)

    await _set_step(analysis, "Anhänge werden geprüft", db)
    attachments = _attachments_of(msg)
    await _check_attachments(attachments)

    await _set_step(analysis, "KI-Einschätzung wird eingeholt", db)
    ai = await assess(msg)

    # Results and the final status together, a failed try leaves nothing behind
    async with db.begin():
        for attachment in attachments:
            db.add(MailAttachment(mail_analysis_id=analysis.id, **attachment))

        for link in detection.links:
            db.add(MailLink(mail_analysis_id=analysis.id, **link))

        analysis.criteria = detection.criteria
        analysis.confidence_score = detection.score
        analysis.verdict = detection.verdict
        analysis.ai_verdict = ai["verdict"] if ai else None
        analysis.ai_confidence = ai["confidence"] if ai else None
        analysis.ai_model = ai["model"] if ai else None
        analysis.status = "completed"
        analysis.step = None
        analysis.error = None
        analysis.completed_at = datetime.utcnow()
        db.add(analysis)


async def record_failure(
    analysis_id: int,
    exc: Exception,
    attempt: int,
    max_attempts: int,
    db: AsyncSession,
) -> None:
    """Keeps the error for the detail page. Failed only after the last try."""
    # whatever the failed try left open is thrown away
    await db.rollback()

    async with db.begin():
        analysis = await db.get(MailAnalysis, analysis_id)

        if analysis is None:
            return

        analysis.error = {
            "detail": str(exc) or type(exc).__name__,
            "step": analysis.step,
            "attempt": attempt,
            "max_attempts": max_attempts,
            "at": datetime.utcnow().isoformat(),
        }
        analysis.status = "failed" if attempt >= max_attempts else "pending"
        db.add(analysis)
