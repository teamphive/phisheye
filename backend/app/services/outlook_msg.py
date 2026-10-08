"""Turns an Outlook .msg into a normal .eml.

A .msg is a binary Office file (OLE), not text like an .eml. Everything after
the upload (MinIO, the job, the download) only knows .eml, so the .msg is
converted once at the start and only the .eml is kept.
"""

import io
import logging
import re
from email.message import EmailMessage

import extract_msg

logger = logging.getLogger(__name__)

# Every OLE file starts with these bytes, Word .doc and Excel .xls as well
OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# These describe the old MIME structure, the new mail gets its own
_SKIPPED_HEADERS = {"content-type", "content-transfer-encoding", "mime-version"}


class MsgError(ValueError):
    pass


def is_msg(content: bytes) -> bool:
    return content.startswith(OLE_MAGIC)


def _clean(value) -> str:
    # extract_msg sometimes leaves the NUL padding of the file at the end
    text = str(value or "").strip("\x00").strip()
    # Long headers are folded over several lines in the original. Python
    # refuses line breaks in a value, so they are joined back into one line
    return re.sub(r"\r?\n[ \t]*", " ", text)


def _copy_headers(source, mail: EmailMessage) -> None:
    """The headers of the mail as it arrived, Authentication-Results included.

    A .msg that was never sent (a draft) has none.
    """
    if source is None:
        return

    for name, value in source.items():
        value = _clean(value)

        if not value or name.lower() in _SKIPPED_HEADERS:
            continue

        try:
            mail[name] = value
        except (ValueError, TypeError):
            # e.g. a second Subject, the new mail may only have one
            logger.warning("Skipped header %s of a .msg", name)


def msg_to_eml(content: bytes) -> bytes:
    try:
        with extract_msg.openMsg(io.BytesIO(content)) as msg:
            mail = EmailMessage()
            _copy_headers(msg.header, mail)

            # a draft has no From header, the .msg still knows the sender
            if not mail["Subject"] and _clean(msg.subject):
                mail["Subject"] = _clean(msg.subject)
            if not mail["From"] and _clean(msg.sender):
                mail["From"] = _clean(msg.sender)

            # the body keeps its line breaks, only the NUL padding goes
            mail.set_content((msg.body or "").strip("\x00"))

            if msg.htmlBody:
                html = msg.htmlBody.decode("utf-8", errors="replace")
                mail.add_alternative(html, subtype="html")

            # Our own add_attachment instead of extract_msg's asEmailMessage:
            # that one nests the files where iter_attachments does not look,
            # and they would skip the attachment checks
            for attachment in msg.attachments:
                data = attachment.data

                # an attached mail or a link instead of a file, nothing to hash
                if not isinstance(data, bytes):
                    continue

                filename = (
                    _clean(attachment.longFilename)
                    or _clean(attachment.shortFilename)
                    or "unnamed"
                )
                # one neutral type for all, the checks read the bytes anyway
                mail.add_attachment(
                    data,
                    maintype="application",
                    subtype="octet-stream",
                    filename=filename,
                )
    # the file comes from outside, any error in the library means unreadable
    except Exception as exc:
        raise MsgError("Die .msg-Datei kann nicht gelesen werden") from exc

    return mail.as_bytes()
