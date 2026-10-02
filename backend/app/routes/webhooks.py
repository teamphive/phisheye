from email import policy
from email.parser import BytesParser
from email.utils import parseaddr

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..services.domains import team_for_address
from ..services.mail_analysis import submit_analysis
from ..services.mailgun import verify_mailgun_signature
from ..services.pop3_poller import extract_eml, extract_reporter
from ..services.system_defaults import ensure_system_defaults

router = APIRouter(tags=["webhooks"])


def _sender_domain(eml_content: bytes) -> str | None:
    msg = BytesParser(policy=policy.default).parsebytes(eml_content)
    _, address = parseaddr(str(msg.get("From", "")))

    if "@" not in address:
        return None

    return address.split("@", 1)[1].strip().lower()


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

    content = extract_eml(outer_content)
    sender_domain = _sender_domain(content)

    default_team, system_user = await ensure_system_defaults(db)

    # the team that owns the reporter's domain, otherwise the default
    team_id = await team_for_address(extract_reporter(outer_content), db)

    analysis = await submit_analysis(
        content=content,
        team_id=team_id or default_team.id,
        submitted_by=system_user.id,
        db=db,
    )

    return {
        "id": analysis.id,
        "sender_domain": sender_domain,
        "status": analysis.status,
    }
