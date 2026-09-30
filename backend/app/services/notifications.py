import logging
import os
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr
from pathlib import Path

from arq import create_pool
from arq.connections import RedisSettings
from jinja2 import Environment, FileSystemLoader

from ..models.mail_analysis import MailAnalysis

logger = logging.getLogger(__name__)

# autoescape is required: subject and sender come from the reported mail
_templates = Environment(
    loader=FileSystemLoader(Path(__file__).parent.parent / "templates" / "email"),
    autoescape=True,
)

_TONES = {
    "clean": {
        "label": "Sauber",
        "color": "#0e8f63",
        "soft": "#dcf3e9",
        "headline": "Wir haben nichts Auffälliges gefunden",
        "advice": "Die Mail sieht unbedenklich aus. Bei Zweifeln melde dich beim Security-Team.",
    },
    "suspicious": {
        "label": "Verdächtig",
        "color": "#b06a00",
        "soft": "#fbeeda",
        "headline": "Diese Mail ist verdächtig",
        "advice": "Klicke keine Links an und öffne keine Anhänge, bis du den Absender auf anderem Weg bestätigt hast.",
    },
    "phishing": {
        "label": "Phishing",
        "color": "#c42e3b",
        "soft": "#fbe4e6",
        "headline": "Diese Mail ist sehr wahrscheinlich Phishing",
        "advice": "Antworte nicht, öffne keine Links und keine Anhänge. Lösche die Mail.",
    },
}


_NO_REPLY_LOCALS = {
    "mailer-daemon",
    "postmaster",
    "no-reply",
    "noreply",
    "do-not-reply",
}


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6379/0"))


async def enqueue_analysis_ready(analysis_id: int) -> None:
    """Queues the notification mail. Never fails the analysis itself."""
    try:
        pool = await create_pool(redis_settings())
        try:
            # fixed job id: arq ignores a second enqueue for the same analysis
            await pool.enqueue_job(
                "send_analysis_ready",
                analysis_id,
                _job_id=f"analysis-ready-{analysis_id}",
            )
        finally:
            await pool.aclose()
    except Exception:
        logger.exception("Could not queue notification for analysis %s", analysis_id)


async def enqueue_team_invitation(invitation_id: int) -> None:
    """Queues the invitation mail. Never fails the invitation itself."""
    try:
        pool = await create_pool(redis_settings())
        try:
            await pool.enqueue_job(
                "send_team_invitation",
                invitation_id,
                _job_id=f"team-invitation-{invitation_id}",
            )
        finally:
            await pool.aclose()
    except Exception:
        logger.exception("Could not queue invitation mail %s", invitation_id)


_ROLE_LABELS = {"admin": "Admin", "analyst": "Analyst", "audit": "Audit (nur lesen)"}


def render_invitation(
    team_name: str,
    inviter_name: str,
    role: str,
    url: str,
    setup_follows: bool = False,
) -> tuple[str, str, str]:
    """Returns subject, plain text and html of the invitation mail."""
    role_label = _ROLE_LABELS.get(role, role)
    html = _templates.get_template("invitation.html").render(
        team_name=team_name,
        inviter_name=inviter_name,
        role_label=role_label,
        url=url,
        setup_follows=setup_follows,
    )
    text = f"{inviter_name} hat dich in das Team {team_name} eingeladen.\n\nRolle: {role_label}\n\n"
    if setup_follows:
        text += "Du bekommst gleich eine zweite Mail, mit der du dein Konto einrichtest. Danach bist du im Team.\n"
    else:
        text += (
            f"Melde dich mit dieser E-Mail-Adresse an: {url}\nDanach bist du im Team.\n"
        )
    return f"Einladung ins Team {team_name}", text, html


def send_invitation_mail(
    to: str,
    team_name: str,
    inviter_name: str,
    role: str,
    setup_follows: bool = False,
) -> None:
    url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    subject, text, html = render_invitation(
        team_name, inviter_name, role, url, setup_follows
    )
    _send(to, subject, text, html)


def render_received(analysis: MailAnalysis) -> tuple[str, str, str]:
    """Returns subject, plain text and html of the receipt mail."""
    html = _templates.get_template("received.html").render(analysis=analysis)
    text = (
        "Wir haben deine Mail erhalten.\n\n"
        f"Betreff: {analysis.subject}\n"
        f"Absender: {analysis.sender}\n\n"
        "Wir prüfen sie umgehend und melden uns mit dem Ergebnis.\n"
    )
    return "Wir haben deine Mail erhalten", text, html


def render_result(
    analysis: MailAnalysis, reasons: list[dict[str, str]]
) -> tuple[str, str, str]:
    """Returns subject, plain text and html of the result mail.

    `reasons` is a list of `{"name": ..., "finding": ...}`, one per triggered check.
    """
    verdict = analysis.verdict or "suspicious"
    tone = _TONES[verdict]
    html = _templates.get_template("result.html").render(
        analysis=analysis, verdict=verdict, tone=tone, reasons=reasons
    )
    lines = [f"{tone['headline']} ({tone['label']})", "", tone["advice"], ""]
    lines += [f"Betreff: {analysis.subject}", f"Absender: {analysis.sender}", ""]
    lines.append("Begründung:")
    lines += [f"- {r['name']}: {r['finding']}" for r in reasons] or [
        "Keine der Prüfungen hat ausgelöst."
    ]
    return f"Ergebnis: {tone['label']}", "\n".join(lines) + "\n", html


def is_notifiable(address: str) -> bool:
    """Guards against mail loops and addresses nobody should write to."""
    _, parsed = parseaddr(address)
    local, _, domain = parsed.partition("@")
    own = (os.getenv("SMTP_USERNAME") or "").lower()

    return bool(
        local
        and "." in domain
        and parsed.lower() != own
        and local.lower() not in _NO_REPLY_LOCALS
    )


def send_analysis_mail(to: str, analysis: MailAnalysis) -> None:
    """Sends the result mail once a verdict exists, the receipt mail before."""
    if analysis.verdict in _TONES:
        # TODO: pass the triggered checks once they are stored
        subject, text, html = render_result(analysis, [])
    else:
        subject, text, html = render_received(analysis)

    _send(to, subject, text, html)


def _send(to: str, subject: str, text: str, html: str) -> None:
    host = os.getenv("SMTP_HOST", "smtp.strato.de")
    port = int(os.getenv("SMTP_PORT", "465"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")

    if not (username and password):
        raise RuntimeError("SMTP_USERNAME/SMTP_PASSWORD are not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = username
    message["To"] = to
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
        smtp.login(username, password)
        smtp.send_message(message)
