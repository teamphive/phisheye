import hashlib
import logging
import os
from email import policy
from email.parser import BytesParser

import vt
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment
from .object_storage import ObjectStorageError, delete_object, store_eml

logger = logging.getLogger(__name__)


async def analyze_and_store(
    *,
    content: bytes,
    team_id: int,
    submitted_by: int,
    db: AsyncSession,
) -> tuple[MailAnalysis, list[dict]]:
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    msg = BytesParser(policy=policy.default).parsebytes(content)
    attachments = []

    for part in msg.iter_attachments():
        file_bytes = part.get_payload(decode=True)

        if file_bytes is None:
            continue

        attachments.append(
            {
                "filename": part.get_filename() or "unnamed",
                "sha256": hashlib.sha256(file_bytes).hexdigest(),
                "mime_type": part.get_content_type(),
            }
        )

    results = []

    if attachments:
        api_key = os.getenv("VT_API_KEY")

        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="VirusTotal API key is not configured",
            )

        async with vt.Client(api_key) as client:
            for attachment in attachments:
                try:
                    vt_result = await client.get_object_async(
                        f"/files/{attachment['sha256']}"
                    )
                except vt.APIError as exc:
                    if exc.code == "NotFoundError":
                        vt_result = None
                    else:
                        raise HTTPException(
                            status_code=502,
                            detail="VirusTotal lookup failed",
                        ) from exc

                results.append(
                    {
                        **attachment,
                        "vt_results": (
                            vt_result.last_analysis_results
                            if vt_result is not None
                            else None
                        ),
                    }
                )

    storage_key = await store_eml(content)

    try:
        # Store the analysis and attachments together
        async with db.begin():
            analysis = MailAnalysis(
                team_id=team_id,
                submitted_by=submitted_by,
                subject=str(msg.get("Subject", "")),
                sender=str(msg.get("From", "")),
                status="completed",
                storage_key=storage_key,
            )

            db.add(analysis)

            # Load the generated analysis ID
            await db.flush()

            for result in results:
                db.add(
                    MailAttachment(
                        mail_analysis_id=analysis.id,
                        filename=result["filename"],
                        sha256=result["sha256"],
                        mime_type=result["mime_type"],
                        vt_results=result["vt_results"],
                    )
                )
    except SQLAlchemyError:
        try:
            await delete_object(storage_key)
        except ObjectStorageError:
            logger.exception("Failed to remove orphaned EML object %s", storage_key)
        raise

    return analysis, results
