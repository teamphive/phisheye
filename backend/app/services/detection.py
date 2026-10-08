"""The four rule checks from docs/detection-criteria.md.

Every check reads the parsed mail and returns a criterion with name, finding
and weight. A check that did not trigger has weight 0. Nothing here touches the
database or the network, so the checks are easy to test with a handmade mail.
"""

import ipaddress
import re
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import getaddresses, parseaddr
from html.parser import HTMLParser
from urllib.parse import urlsplit

from publicsuffixlist import PublicSuffixList

from ..constants import VERDICT_THRESHOLDS

# accept_unknown=False: "rechnung.pdf" is no domain, because pdf is no TLD
_psl = PublicSuffixList(accept_unknown=False)

# a mail with thousands of links must not fill the database
MAX_LINKS = 100

AUTH_FAILED = "Authentifizierung fehlgeschlagen"
LINK_MISMATCH = "Anzeigetext weicht vom Linkziel ab"
ATTACHMENT_MISMATCH = "Anhang-Typ passt nicht zur Endung"
SENDER_MISMATCH = "From weicht von Reply-To oder Return-Path ab"

WEIGHTS = {
    AUTH_FAILED: 40,
    LINK_MISMATCH: 30,
    ATTACHMENT_MISMATCH: 30,
    SENDER_MISMATCH: 20,
}


@dataclass
class Detection:
    criteria: list[dict]
    links: list[dict]
    score: int
    verdict: str


def _criterion(name: str, finding: str, triggered: bool) -> dict:
    return {
        "name": name,
        "finding": finding,
        "weight": WEIGHTS[name] if triggered else 0,
    }


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return False

    return True


def _base_domain(host: str) -> str:
    """mail.paypal.com and paypal.com are the same sender, both give paypal.com."""
    host = host.lower().rstrip(".")

    if _is_ip(host):
        return host

    return _psl.privatesuffix(host) or host


def _domain_of(address: str) -> str | None:
    _, email = parseaddr(address)

    if "@" not in email:
        return None

    return _base_domain(email.rsplit("@", 1)[1])


# 1. Authentifizierung --------------------------------------------------------

_AUTH_RESULT = re.compile(r"\b(spf|dkim|dmarc)=([a-z]+)", re.IGNORECASE)


def check_authentication(msg: EmailMessage) -> dict:
    # Every server on the way may add this header, the topmost one comes from
    # the server that received the mail last. Lower ones an attacker can forge.
    header = msg.get("Authentication-Results")

    if header is None:
        return _criterion(
            AUTH_FAILED,
            "Kein Authentication-Results-Header, nicht bewertbar",
            False,
        )

    results = {
        method.lower(): result.lower()
        for method, result in _AUTH_RESULT.findall(str(header))
    }

    if not results:
        return _criterion(
            AUTH_FAILED, "Keine Ergebnisse für SPF, DKIM oder DMARC", False
        )

    finding = " · ".join(f"{method}={result}" for method, result in results.items())
    failed = any(result in ("fail", "softfail") for result in results.values())

    return _criterion(AUTH_FAILED, finding, failed)


# 2. Links --------------------------------------------------------------------


class _LinkParser(HTMLParser):
    """Collects every <a href> with the text a reader sees."""

    def __init__(self):
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            text = " ".join("".join(self._text).split())
            self.links.append((text, self._href))
            self._href = None


_URL_IN_TEXT = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
# "paypal.com" or "https://www.paypal.com/login" as the visible text
_DOMAIN_IN_TEXT = re.compile(
    r"^(?:https?://)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[/:?#]\S*)?$", re.IGNORECASE
)


def _text_of(part: EmailMessage) -> str:
    payload = part.get_payload(decode=True) or b""
    charset = part.get_content_charset() or "utf-8"

    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        # an unknown charset name in the header
        return payload.decode("utf-8", errors="replace")


def _raw_links(msg: EmailMessage) -> list[tuple[str, str]]:
    """(text, target) of every link, from the HTML part if there is one."""
    body = msg.get_body(preferencelist=("html", "plain"))

    if body is None:
        return []

    text = _text_of(body)

    if body.get_content_type() == "text/html":
        parser = _LinkParser()
        parser.feed(text)
        return parser.links

    # plain text has no link text, the address is what the reader sees
    return [(url, url) for url in _URL_IN_TEXT.findall(text)]


def _shown_domain(text: str) -> str | None:
    """The domain the link text pretends to lead to, None for normal text."""
    match = _DOMAIN_IN_TEXT.match(text.strip())

    if match is None:
        return None

    host = match.group(1).lower()

    if not _is_ip(host) and _psl.privatesuffix(host) is None:
        return None

    return _base_domain(host)


def extract_links(msg: EmailMessage) -> list[dict]:
    links = []

    for text, target in _raw_links(msg):
        parts = urlsplit(target.strip())

        # mailto:, tel: and anchors lead nowhere a browser opens
        if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
            continue

        host = parts.hostname.lower()
        shown = _shown_domain(text)

        if _is_ip(host):
            finding, tone = "IP statt Domain", "suspicious"
        elif shown is not None and shown != _base_domain(host):
            finding, tone = f"Zeigt {shown}, führt zu {host}", "phishing"
        else:
            finding, tone = "Unauffällig", "clean"

        links.append(
            {
                "text": text,
                "target": target.strip(),
                "host": host,
                "finding": finding,
                "tone": tone,
            }
        )

        if len(links) == MAX_LINKS:
            break

    return links


def check_links(links: list[dict]) -> dict:
    flagged = [link for link in links if link["tone"] != "clean"]

    if not flagged:
        return _criterion(LINK_MISMATCH, "Keine auffälligen Links", False)

    first = flagged[0]
    finding = f"„{first['text']}“ → {first['host']}"

    if len(flagged) > 1:
        finding += f" und {len(flagged) - 1} weitere"

    return _criterion(LINK_MISMATCH, finding, True)


# 3. Anhänge ------------------------------------------------------------------

# How the first bytes of a file with this extension look
_MAGIC = {
    "pdf": (b"%PDF",),
    "png": (b"\x89PNG",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    # the new Office formats are zip files inside
    "zip": (b"PK\x03\x04", b"PK\x05\x06"),
    "docx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
    "pptx": (b"PK\x03\x04",),
    "doc": (b"\xd0\xcf\x11\xe0",),
    "xls": (b"\xd0\xcf\x11\xe0",),
    "ppt": (b"\xd0\xcf\x11\xe0",),
}

# Endings that run something when opened
_DANGEROUS = {
    "exe", "scr", "com", "bat", "cmd", "js", "vbs", "jar",
    "lnk", "iso", "img", "htm", "html", "hta", "msi", "ps1",
}  # fmt: skip

# Endings a victim expects as the "real" type in rechnung.pdf.exe
_DOCUMENTS = set(_MAGIC) | {"txt", "csv", "rtf"}


def _attachment_problem(filename: str, content: bytes) -> str | None:
    parts = filename.lower().rsplit(".", 2)

    if len(parts) == 3 and parts[1] in _DOCUMENTS and parts[2] in _DANGEROUS:
        return f"{filename} hat eine doppelte Endung"

    extension = parts[-1] if len(parts) > 1 else ""

    # MZ starts every Windows program
    if content.startswith(b"MZ") and extension not in _DANGEROUS:
        return f"{filename} ist ein Windows-Programm"

    expected = _MAGIC.get(extension)

    if expected is not None and not content.startswith(expected):
        return f"{filename} ist keine echte .{extension}-Datei"

    return None


def check_attachments(msg: EmailMessage) -> dict:
    problems = []

    for part in msg.iter_attachments():
        content = part.get_payload(decode=True)

        if content is None:
            continue

        problem = _attachment_problem(part.get_filename() or "unnamed", content)

        if problem:
            problems.append(problem)

    if not problems:
        return _criterion(ATTACHMENT_MISMATCH, "Keine auffälligen Anhänge", False)

    return _criterion(ATTACHMENT_MISMATCH, " · ".join(problems), True)


# 4. Absender -----------------------------------------------------------------


def check_sender(msg: EmailMessage) -> dict:
    sender = _domain_of(str(msg.get("From", "")))

    if sender is None:
        return _criterion(SENDER_MISMATCH, "Kein From-Header, nicht bewertbar", False)

    others = [
        address
        for _, address in getaddresses(
            [str(value) for value in msg.get_all("Reply-To", [])]
            + [str(value) for value in msg.get_all("Return-Path", [])]
        )
    ]

    for address in others:
        domain = _domain_of(address)

        # Return-Path <> is a bounce, it has no domain
        if domain is not None and domain != sender:
            return _criterion(SENDER_MISMATCH, f"{domain} statt {sender}", True)

    return _criterion(SENDER_MISMATCH, "Gleiche Domain", False)


# Gesamt ----------------------------------------------------------------------


def verdict_for(score: int) -> str:
    if score >= VERDICT_THRESHOLDS["phishing"]:
        return "phishing"

    if score >= VERDICT_THRESHOLDS["suspicious"]:
        return "suspicious"

    return "clean"


def detect(msg: EmailMessage) -> Detection:
    links = extract_links(msg)
    criteria = [
        check_authentication(msg),
        check_links(links),
        check_attachments(msg),
        check_sender(msg),
    ]

    # four checks can add up to 120, the score stops at 100
    score = min(sum(criterion["weight"] for criterion in criteria), 100)

    return Detection(
        criteria=criteria, links=links, score=score, verdict=verdict_for(score)
    )
