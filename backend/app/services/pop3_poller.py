import os
import poplib
from email import policy
from email.parser import BytesParser


def fetch_new_mails() -> list[bytes]:
    host = os.getenv("POP3_HOST", "pop3.strato.de")
    port = int(os.getenv("POP3_PORT", "995"))
    username = os.getenv("POP3_USERNAME")
    password = os.getenv("POP3_PASSWORD")

    if not (username and password):
        raise RuntimeError("POP3_USERNAME/POP3_PASSWORD sind nicht konfiguriert")

    connection = poplib.POP3_SSL(host, port)

    try:
        connection.user(username)
        connection.pass_(password)

        message_count, _ = connection.stat()
        raw_mails: list[bytes] = []

        for i in range(1, message_count + 1):
            _, lines, _ = connection.retr(i)
            raw_mails.append(b"\n".join(lines))
            connection.dele(i)

        connection.quit()
        return raw_mails
    except Exception:
        connection.rset()
        connection.quit()
        raise


def extract_eml(raw_mail: bytes) -> bytes:
    msg = BytesParser(policy=policy.default).parsebytes(raw_mail)

    for part in msg.walk():
        if part.get_content_type() != "message/rfc822":
            continue

        payload = part.get_payload()

        if isinstance(payload, list) and payload:
            return payload[0].as_bytes()

    return raw_mail
