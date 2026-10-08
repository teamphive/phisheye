import mimetypes
import re
from email.header import Header
from email.message import EmailMessage
from email.utils import format_datetime, formataddr, getaddresses
from io import BytesIO

import extract_msg

from .eml_validation import InvalidEmlError

# first bytes of an OLE2 container, the format of Outlook .msg files
_OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

_HEADER_NAME = re.compile(r"^[A-Za-z0-9-]+$")

# the converted mail brings its own structure
_SKIPPED_HEADERS = {
    "content-type",
    "content-transfer-encoding",
    "mime-version",
    "content-disposition",
}


def is_msg(content: bytes) -> bool:
    return content.startswith(_OLE_SIGNATURE)


def _clean(value) -> str:
    """One line, no NUL: folded headers and binary junk stay out of the mail."""
    return re.sub(r"\s*[\r\n]+\s*", " ", str(value).replace("\x00", "")).strip()


def _addresses(value) -> str:
    """Address list with the display names encoded, plain ascii stays as it is."""
    pairs = getaddresses([_clean(value)])

    return ", ".join(formataddr(pair, charset="utf-8") for pair in pairs if pair[1])


def _attr(obj, name):
    # extract-msg raises on some malformed fields, the rest is still usable
    try:
        return getattr(obj, name)
    except Exception:
        return None


def msg_to_eml(content: bytes) -> bytes:
    """Turns an Outlook .msg into the bytes of a flat .eml.

    The transport headers (Received, DKIM and so on) are copied when the mail
    carries them, a draft has none. Attachments become plain parts, so the
    analysis finds them like in any other mail.
    """
    try:
        source = extract_msg.openMsg(BytesIO(content))
    except Exception as error:
        raise InvalidEmlError("The file is not a valid .msg") from error

    try:
        # written by hand: the email package refuses to fold some header
        # values of real mails, and their exact text is what the analysis reads
        headers: list[tuple[str, str]] = []

        transport = _attr(source, "header")
        for name, value in transport.items() if transport else []:
            if name.lower() not in _SKIPPED_HEADERS and _HEADER_NAME.match(name):
                headers.append((name, _clean(value)))

        present = {name.lower() for name, _ in headers}

        # only what the transport headers did not bring
        subject = _clean(_attr(source, "subject") or "")
        if "subject" not in present and subject:
            headers.append(("Subject", Header(subject, "utf-8").encode()))

        sender = _attr(source, "sender")
        if "from" not in present and sender:
            headers.append(("From", _addresses(sender)))

        sent = _attr(source, "date")
        if "date" not in present and sent:
            headers.append(("Date", format_datetime(sent)))

        to = _attr(source, "to")
        if "to" not in present and to:
            headers.append(("To", _addresses(to)))

        body = EmailMessage()
        text = _attr(source, "body")
        html = _attr(source, "htmlBody")
        if isinstance(html, bytes):
            html = html.decode("utf-8", errors="replace")

        body.set_content(text or "")
        if html:
            body.add_alternative(html, subtype="html")

        for attachment in _attr(source, "attachments") or []:
            data = _attr(attachment, "data")

            # a nested .msg comes as an object, not as bytes
            if not isinstance(data, bytes):
                continue

            filename = (
                _clean(_attr(attachment, "longFilename") or "")
                or _clean(_attr(attachment, "shortFilename") or "")
                or "unnamed"
            )
            guessed, _ = mimetypes.guess_type(filename)
            maintype, _, subtype = (
                _clean(_attr(attachment, "mimetype") or "")
                or guessed
                or "application/octet-stream"
            ).partition("/")
            body.add_attachment(
                data,
                maintype=maintype,
                subtype=subtype or "octet-stream",
                filename=filename,
            )

        lines = "".join(f"{name}: {value}\r\n" for name, value in headers)

        return lines.encode("utf-8") + body.as_bytes()
    finally:
        source.close()
