from email import policy
from email.parser import BytesParser
import hashlib
import os

import load_dotenv
import vt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.mail_attachment import MailAttachment

load_dotenv.load_dotenv()

router = APIRouter(tags=["analyses"])


@router.post("/analyze")
async def analyze_email(
    file: UploadFile = File(...),
    team_id: int = Form(...),
    submitted_by: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    msg = BytesParser(policy=policy.default).parsebytes(content)
    attachments = []

    for part in msg.iter_attachments():
        file_bytes = part.get_payload(decode=True)

        if file_bytes is None:
            continue

        attachments.append({
            "filename": part.get_filename() or "unnamed",
            "sha256": hashlib.sha256(file_bytes).hexdigest(),
            "mime_type": part.get_content_type(),
        })

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

                results.append({
                    **attachment,
                    "vt_results": (
                        vt_result.last_analysis_results
                        if vt_result is not None
                        else None
                    ),
                })

    # Save the analysis and attachments together.
    # Any database failure rolls back the entire transaction.
    async with db.begin():
        analysis = MailAnalysis(
            team_id=team_id,
            submitted_by=submitted_by,
            subject=str(msg.get("Subject", "")),
            sender=str(msg.get("From", "")),
            status="completed",
        )

        db.add(analysis)

        # Execute the INSERT so the generated analysis ID is available.
        await db.flush()

        for attachment in attachments:
            db.add(
                MailAttachment(
                    mail_analysis_id=analysis.id,
                    filename=attachment["filename"],
                    sha256=attachment["sha256"],
                    mime_type=attachment["mime_type"],
                )
            )

    return {
        "id": analysis.id,
        "subject": analysis.subject,
        "sender": analysis.sender,
        "status": analysis.status,
        "attachments": results,
    }