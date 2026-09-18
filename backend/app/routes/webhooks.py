import os
from email import policy
from email.parser import BytesParser

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..services.mail_analysis import analyze_and_store
from ..services.mailgun import verify_mailgun_signature

router = APIRouter(tags=["webhooks"])


def _extract_eml_attachment(raw_mime: bytes) -> bytes:
    outer_msg = BytesParser(policy=policy.default).parsebytes(raw_mime)

    for part in outer_msg.iter_attachments():
        filename = (part.get_filename() or "").lower()
        content_type = part.get_content_type()

        is_eml = filename.endswith(".eml") or content_type in (
            "message/rfc822",
            "application/octet-stream",
        )

        if is_eml:
            payload = part.get_payload(decode=True)
            if payload:
                return payload

    return raw_mime


@router.post("/webhooks/inbound-mail")
async def inbound_mail(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    form = await request.form()

    timestamp = form.get("timestamp")
    token = form.get("token")
    signature = form.get("signature")

    if not (timestamp and token and signature):
        raise HTTPException(status_code=400, detail="Missing Mailgun signature fields")

    if not verify_mailgun_signature(str(timestamp), str(token), str(signature)):
        raise HTTPException(status_code=401, detail="Invalid Mailgun signature")

    raw_mime = form.get("body-mime")

    if raw_mime is None:
        raise HTTPException(status_code=400, detail="No body-mime in payload")

    outer_content = (
        raw_mime.encode("utf-8") if isinstance(raw_mime, str) else await raw_mime.read()
    )

    content = _extract_eml_attachment(outer_content)

    system_team_id = os.getenv("PHISHEYE_SYSTEM_TEAM_ID")
    system_user_id = os.getenv("PHISHEYE_SYSTEM_USER_ID")

    if not (system_team_id and system_user_id):
        raise HTTPException(
            status_code=503,
            detail="System team/user for inbound mail is not configured",
        )

    analysis = await analyze_and_store(
        content=content,
        team_id=int(system_team_id),
        submitted_by=int(system_user_id),
        db=db,
    )

    return {"id": analysis.id, "status": analysis.status}
