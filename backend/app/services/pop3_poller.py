import base64
import os
import poplib
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr


def _connect() -> poplib.POP3_SSL:
    host = os.getenv("POP3_HOST", "pop3.strato.de")
    port = int(os.getenv("POP3_PORT", "995"))
    username = os.getenv("POP3_USERNAME")
    password = os.getenv("POP3_PASSWORD")

    if not (username and password):
        raise RuntimeError("POP3_USERNAME/POP3_PASSWORD are not configured")

    connection = poplib.POP3_SSL(host, port)
    connection.user(username)
    connection.pass_(password)
    return connection


def fetch_new_mails() -> list[tuple[str, bytes]]:
    """Fetches pending mails, keyed by POP3 UIDL.

    Mails stay on the server until `delete_mails` confirms success. A
    downstream failure loses nothing.
    """
    connection = _connect()

    try:
        message_count, _ = connection.stat()
        mails: list[tuple[str, bytes]] = []

        for i in range(1, message_count + 1):
            uid = connection.uidl(i).split()[-1].decode()
            _, lines, _ = connection.retr(i)
            mails.append((uid, b"\n".join(lines)))

        connection.quit()
        return mails
    except Exception:
        connection.rset()
        connection.quit()
        raise


def delete_mails(uids: set[str]) -> None:
    """Delete mails identified by their POP3 UIDL from the mailbox"""
    if not uids:
        return

    connection = _connect()

    try:
        message_count, _ = connection.stat()

        for i in range(1, message_count + 1):
            uid = connection.uidl(i).split()[-1].decode()
            if uid in uids:
                connection.dele(i)

        connection.quit()
    except Exception:
        connection.rset()
        connection.quit()
        raise


def extract_eml(raw_mail: bytes) -> bytes:
    msg = BytesParser(policy=policy.default).parsebytes(raw_mail)

    for part in msg.walk():
        if part.get_content_type() == "message/rfc822":
            payload = part.get_payload()

            if isinstance(payload, list) and payload:
                # base64 here is non-standard but common (GMX, Outlook), the
                # parser then keeps the still encoded text as the body
                if str(part.get("Content-Transfer-Encoding", "")).lower() == "base64":
                    return base64.b64decode(payload[0].get_payload())

                return payload[0].as_bytes()

        # some clients attach the forwarded mail as a plain file, Outlook
        # as .msg
        elif (part.get_filename() or "").lower().endswith((".eml", ".msg")):
            content = part.get_payload(decode=True)

            if content:
                return content

    return raw_mail


def extract_reporter(raw_mail: bytes) -> str | None:
    """Address of the person who forwarded the mail, None for auto-replies."""
    msg = BytesParser(policy=policy.default).parsebytes(raw_mail)

    if str(msg.get("Auto-Submitted", "no")).lower() != "no":
        return None

    _, address = parseaddr(str(msg.get("From", "")))
    return address.lower() if "@" in address else None
