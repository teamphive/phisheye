"""JEV's reading of the mail text, see docs/ai-assessment.md.

A second opinion next to the rules. It never changes score or verdict: text in
a phishing mail can be written to talk JEV out of its answer.
"""

import logging
import os
from email.message import EmailMessage
from html.parser import HTMLParser

from typesafe_sdk import AsyncTypeSafeClient, Choice, TypeSafeError

from .monitoring import count_jev_usage

logger = logging.getLogger(__name__)

# A fixed version instead of jev-latest: the alias moves without warning on a
# new release, and the confidence thresholds of the page hold for one version
MODEL = "jev-1.13.0"

# A large state makes JEV less exact, state and question share 32,000 tokens
MAX_BODY_CHARS = 20_000

# The SDK tries 429 and 529 again by itself, this caps one try
TIMEOUT_SECONDS = 20

# In English, JEV is trained on it and answers most exactly there
PHISHING_QUESTION = {
    "phishing": Choice(
        instructions="Is this email a phishing attempt?",
        criteria={
            "phishing": (
                "Tries to trick the recipient into giving away credentials, "
                "payment data or money, or into opening a link or attachment, "
                "for example with a spoofed sender, urgency or threats"
            ),
            "legitimate": (
                "An ordinary email that asks for nothing unusual, including "
                "newsletters, invoices and notifications from real senders"
            ),
        },
    ),
}


class _TextParser(HTMLParser):
    """The text a reader sees, without tags, scripts and styles."""

    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._hidden += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._hidden:
            self._hidden -= 1

    def handle_data(self, data):
        if not self._hidden:
            self.parts.append(data)


def _content_of(part: EmailMessage) -> str:
    try:
        return part.get_content()
    except (LookupError, UnicodeError):
        # an unknown or wrong charset in the header
        payload = part.get_payload(decode=True) or b""
        return payload.decode("utf-8", errors="replace")


def body_text(msg: EmailMessage) -> str:
    """The plain text of the mail, from the HTML part if there is no other."""
    body = msg.get_body(preferencelist=("plain", "html"))

    if body is None:
        return ""

    text = _content_of(body)

    if body.get_content_type() == "text/html":
        parser = _TextParser()
        parser.feed(text)
        text = " ".join(parser.parts)

    # one space between words is enough, every character counts for the limit
    return " ".join(text.split())[:MAX_BODY_CHARS]


def mail_state(msg: EmailMessage) -> dict:
    """Only what the question needs. Headers, links and attachments are the
    rules' job."""
    return {
        "from": str(msg.get("From", "")),
        "reply_to": str(msg.get("Reply-To", "")),
        "subject": str(msg.get("Subject", "")),
        "body": body_text(msg),
    }


async def assess(msg: EmailMessage) -> dict | None:
    """verdict, confidence and model, or None if JEV gave no answer.

    None never fails the analysis, the detail page then shows
    "Keine KI-Einschätzung".
    """
    if not os.getenv("TYPESAFE_API_KEY"):
        logger.warning("TYPESAFE_API_KEY is not set, no AI assessment")
        return None

    try:
        # the SDK reads TYPESAFE_API_KEY itself
        async with AsyncTypeSafeClient(model=MODEL, timeout=TIMEOUT_SECONDS) as client:
            response = await client.system_one(mail_state(msg), PHISHING_QUESTION)

        # counted before reading the answer: the tokens are billed either way
        await count_jev_usage(response.usage.input_tokens)
        answer = response.choices["phishing"]
    # wrong key, rate limit, timeout, an answer without our question
    except (TypeSafeError, KeyError) as exc:
        logger.warning("JEV assessment failed: %s", type(exc).__name__)
        return None

    return {
        "verdict": "phishing" if answer.choice == "phishing" else "clean",
        "confidence": answer.confidence,
        "model": response.model,
    }
