import logging
import os
import re
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import parseaddr
from pathlib import Path

from arq import create_pool
from arq.connections import RedisSettings
from jinja2 import Environment, FileSystemLoader
from publicsuffixlist import PublicSuffixList

from ..constants import DECISION_MAIL_DELAY_SECONDS
from ..models.mail_analysis import MailAnalysis
from . import detection
from .keycloak_admin import SETUP_LINK_LIFESPAN

logger = logging.getLogger(__name__)

# autoescape is required: subject and sender come from the reported mail
_templates = Environment(
    loader=FileSystemLoader(Path(__file__).parent.parent / "templates" / "email"),
    autoescape=True,
)

# known suffixes only, so "rechnung.pdf.htm" or "M. Sandmann" stay as they are
_psl = PublicSuffixList(accept_unknown=False)
_HOST = re.compile(
    r"\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b", re.IGNORECASE
)
_SCHEME = re.compile(r"\bhttp(s?)://", re.IGNORECASE)

# What a triggered check means for someone who only reported the mail. The
# technical finding is shown where it helps, the auth results would not.
_REASON_TEXTS = {
    detection.AUTH_FAILED: (
        "Absender nicht bestätigt",
        "Der Server, von dem die Mail angeblich kommt, hat sie nicht als echt bestätigt. Die Absenderadresse ist wahrscheinlich gefälscht.",
        False,
    ),
    detection.LINK_MISMATCH: (
        "Link führt woanders hin",
        "Ein Link zeigt eine vertraute Adresse an, öffnet aber eine andere Seite.",
        True,
    ),
    detection.ATTACHMENT_MISMATCH: (
        "Getarnter Anhang",
        "Ein Anhang gibt sich als harmloses Dokument aus, ist aber etwas anderes.",
        True,
    ),
    detection.SENDER_MISMATCH: (
        "Absender passt nicht zusammen",
        "Antworten oder Rückläufer gehen an eine andere Adresse als die angezeigte.",
        True,
    ),
}

# The mail always tells what an analyst decided, never the automatic verdict
_TONES = {
    "clean": {
        "label": "Legitim",
        "color": "#15803d",
        "soft": "#e9f6ee",
        "headline": "Die Mail ist legitim",
        "advice": "Das Security-Team hat sich die Mail angesehen und nichts Gefährliches gefunden. Du kannst sie ganz normal behandeln. Bei Zweifeln melde dich beim Security-Team.",
        "thanks": "Danke fürs Melden. Lieber einmal zu viel als einmal zu wenig.",
    },
    "phishing": {
        "label": "Phishing",
        "color": "#c62828",
        "soft": "#fbeaea",
        "headline": "Die Mail ist Phishing",
        "advice": "Das Security-Team hat die Mail geprüft und als Phishing bestätigt. Antworte nicht, öffne keine Links und keine Anhänge und lösche die Mail. Hast du schon geklickt oder etwas eingegeben, melde dich sofort beim Security-Team.",
        "thanks": "Danke fürs Melden. Damit hast du auch andere geschützt.",
    },
}

# confirmed by hand, none of the rules had fired
_NO_REASONS = "Unsere automatischen Prüfungen haben hier nicht angeschlagen, das Security-Team hat die Mail selbst als Phishing erkannt."


_NO_REPLY_LOCALS = {
    "mailer-daemon",
    "postmaster",
    "no-reply",
    "noreply",
    "do-not-reply",
}


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6379/0"))


async def enqueue_decision_mail(analysis_id: int, decided_at: datetime) -> None:
    """Queues the mail for a decision, it goes out after a pause.

    Never fails the decision. Every click gets its own job id, arq would
    ignore a repeated one. The job looks at the state when it runs.
    """
    try:
        pool = await create_pool(redis_settings())
        try:
            await pool.enqueue_job(
                "send_decision_mail",
                analysis_id,
                _job_id=f"decision-mail-{analysis_id}-{decided_at.timestamp()}",
                _defer_by=timedelta(seconds=DECISION_MAIL_DELAY_SECONDS),
            )
        finally:
            await pool.aclose()
    except Exception:
        logger.exception("Could not queue the decision mail for %s", analysis_id)


async def enqueue_receipt_mail(analysis_id: int) -> None:
    """Queues the receipt for a report that came in by mail.

    Never fails the analysis. The job id keeps a second enqueue out.
    """
    try:
        pool = await create_pool(redis_settings())
        try:
            await pool.enqueue_job(
                "send_receipt_mail",
                analysis_id,
                _job_id=f"receipt-mail-{analysis_id}",
            )
        finally:
            await pool.aclose()
    except Exception:
        logger.exception("Could not queue the receipt for analysis %s", analysis_id)


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
    # the Keycloak link of the second mail, the invitation itself does not expire
    setup_days = SETUP_LINK_LIFESPAN // (24 * 60 * 60)
    html = _render(
        "invitation.html",
        team_name=team_name,
        inviter_name=inviter_name,
        role_label=role_label,
        url=url,
        setup_follows=setup_follows,
        setup_days=setup_days,
    )
    text = f"{inviter_name} hat dich in das Team {team_name} eingeladen.\n\nRolle: {role_label}\n\n"
    if setup_follows:
        text += (
            "Du bekommst gleich eine zweite Mail, mit der du dein Konto einrichtest. "
            f"Der Link darin ist {setup_days} Tage gültig. Danach bist du im Team.\n"
        )
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


def defang(text: str) -> str:
    """Mail clients turn domains into links, also the ones of a phishing mail.

    `evil.top` becomes `evil[.]top` and `https://` becomes `hxxps://`, the way
    security notices write them.
    """

    def host(match: re.Match) -> str:
        name = match.group(0)
        if _psl.privatesuffix(name.lower()) is None:
            return name
        return name.replace(".", "[.]")

    return _HOST.sub(host, _SCHEME.sub(r"hxxp\1://", text))


def _render(template: str, **context) -> str:
    # the logo lies next to the frontend, mail clients load it from there
    app_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return _templates.get_template(template).render(app_url=app_url, **context)


def _mail_facts(analysis: MailAnalysis) -> dict[str, str]:
    """Subject and sender of the reported mail, safe to show in a mail."""
    return {
        "subject": defang(" ".join((analysis.subject or "").split()))
        or "(ohne Betreff)",
        "sender": defang(analysis.sender or ""),
    }


def _subject_line(prefix: str, subject: str) -> str:
    # the reported subject tells several reports apart in the inbox
    if len(subject) > 60:
        subject = subject[:59].rstrip() + "…"
    return f"{prefix}: {subject}"


def _explain(reasons: list[dict[str, str]]) -> list[dict[str, str | None]]:
    """The triggered checks in words a reporter understands."""
    explained = []

    for reason in reasons:
        title, text, show_finding = _REASON_TEXTS.get(
            reason["name"], (reason["name"], "", True)
        )
        explained.append(
            {
                "title": title,
                "text": text,
                "finding": defang(reason["finding"]) if show_finding else None,
            }
        )

    return explained


def render_received(analysis: MailAnalysis) -> tuple[str, str, str]:
    """Returns subject, plain text and html of the receipt mail."""
    mail = _mail_facts(analysis)
    html = _render("received.html", mail=mail)
    text = (
        "Danke für deine Meldung.\n\n"
        "Das Security-Team schaut sich die Mail an und meldet sich mit dem Ergebnis. "
        "Bis dahin: keine Links öffnen, keine Anhänge öffnen.\n\n"
        f"Betreff: {mail['subject']}\n"
        f"Absender: {mail['sender']}\n"
    )
    return _subject_line("Meldung erhalten", mail["subject"]), text, html


def render_failed(analysis: MailAnalysis) -> tuple[str, str, str]:
    """Returns subject, plain text and html of the mail for a failed analysis."""
    mail = _mail_facts(analysis)
    html = _render("failed.html", mail=mail)
    text = (
        "Wir konnten deine Mail nicht prüfen.\n\n"
        "Bei der Prüfung ist ein Fehler aufgetreten. Melde die Mail bitte in ein "
        "paar Minuten noch einmal. Bis dahin: keine Links öffnen, keine Anhänge öffnen.\n\n"
        f"Betreff: {mail['subject']}\n"
        f"Absender: {mail['sender']}\n"
    )
    return _subject_line("Nicht geprüft", mail["subject"]), text, html


def render_result(
    analysis: MailAnalysis,
    reasons: list[dict[str, str]],
    verdict: str,
    correction: bool = False,
) -> tuple[str, str, str]:
    """Returns subject, plain text and html of the result mail.

    `reasons` is a list of `{"name": ..., "finding": ...}`, one per triggered check.
    `verdict` is what the analyst decided, `phishing` or `clean`.
    `correction` marks a mail that replaces an earlier one with another verdict.
    """
    tone = _TONES[verdict]
    mail = _mail_facts(analysis)
    explained = _explain(reasons)
    html = _render(
        "result.html",
        mail=mail,
        verdict=verdict,
        tone=tone,
        reasons=explained,
        no_reasons=_NO_REASONS,
        correction=correction,
    )

    lines = []
    if correction:
        lines += [
            "Neubewertung: Das Security-Team hat seine Einschätzung geändert. "
            "Diese Nachricht ersetzt die letzte zu dieser Mail.",
            "",
        ]
    lines += [tone["headline"], "", tone["advice"], ""]
    lines += [f"Betreff: {mail['subject']}", f"Absender: {mail['sender']}", ""]
    if verdict == "phishing":
        lines.append("Was uns aufgefallen ist:")
        for reason in explained:
            lines.append(f"- {reason['title']}: {reason['text']}")
            if reason["finding"]:
                lines.append(f"  {reason['finding']}")
        if not explained:
            lines.append(_NO_REASONS)
        lines.append("")
    lines.append(tone["thanks"])

    prefix = f"Neubewertung ({tone['label']})" if correction else tone["label"]
    return _subject_line(prefix, mail["subject"]), "\n".join(lines) + "\n", html


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


def send_receipt_mail(to: str, analysis: MailAnalysis) -> None:
    """Tells the reporter that the mail arrived, nothing about its verdict."""
    subject, text, html = render_received(analysis)
    _send(to, subject, text, html)


def send_failure_mail(to: str, analysis: MailAnalysis) -> None:
    """Tells the reporter that the analysis did not finish."""
    subject, text, html = render_failed(analysis)
    _send(to, subject, text, html)


def send_verdict_mail(
    to: str, analysis: MailAnalysis, verdict: str, correction: bool = False
) -> None:
    """Tells the reporter what the analyst decided, with the reasons for phishing."""
    reasons = [
        {"name": criterion["name"], "finding": criterion["finding"]}
        for criterion in analysis.criteria or []
        if criterion.get("weight", 0) > 0
    ]
    # a mail judged harmless has no use for the reasons of a wrong alarm
    subject, text, html = render_result(
        analysis, reasons if verdict == "phishing" else [], verdict, correction
    )
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
