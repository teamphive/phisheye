# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import email
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser

import pytest
from test_analysis_job import storage  # noqa: F401
from test_analyze import api, db, login_as, two_teams  # noqa: F401

from app.services import outlook_msg
from app.services.outlook_msg import OLE_MAGIC, MsgError, is_msg, msg_to_eml
from app.services.pop3_poller import extract_eml

# Real .msg files can only be made with Outlook. The tests replace extract_msg
# with this stand-in, it has the same fields the converter reads.

HEADERS = (
    "From: DHL <rechnung@dhl-versand.top>\n"
    "Subject: Ihre Rechnung\n"
    "Authentication-Results: mx.firma.de;\n"
    "\tspf=fail smtp.mailfrom=dhl-versand.top\n"
    "Content-Type: multipart/mixed\n"
)


class FakeAttachment:
    def __init__(self, filename, data):
        self.longFilename = filename
        self.shortFilename = None
        self.data = data


class FakeMsg:
    def __init__(self, headers=HEADERS, subject=None, sender=None, attachments=()):
        # extract_msg gives the headers as an old-style email.message.Message
        self.header = email.message_from_string(headers) if headers else None
        self.subject = subject
        self.sender = sender
        self.body = "Bitte bezahlen.\nDanke\x00\x00"
        self.htmlBody = b'<a href="https://evil.top">dhl.de</a>'
        self.attachments = list(attachments)

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False


@pytest.fixture
def fake_msg(monkeypatch):
    """Lets each test choose what the next opened .msg contains."""
    current = {"msg": FakeMsg()}

    def open_msg(file):
        assert file.read().startswith(OLE_MAGIC)
        return current["msg"]

    monkeypatch.setattr(outlook_msg.extract_msg, "openMsg", open_msg)
    return current


MSG_BYTES = OLE_MAGIC + b"rest of the file"


def parse(content: bytes) -> EmailMessage:
    return BytesParser(policy=policy.default).parsebytes(content)


def test_is_msg_looks_at_the_first_bytes():
    assert is_msg(MSG_BYTES)
    assert not is_msg(b"From: a@b.de\n\nHallo")


def test_headers_body_and_html_are_kept(fake_msg):
    mail = parse(msg_to_eml(MSG_BYTES))

    assert mail["From"] == "DHL <rechnung@dhl-versand.top>"
    assert mail["Subject"] == "Ihre Rechnung"
    # folded over two lines in the original, one line now
    assert mail["Authentication-Results"] == (
        "mx.firma.de; spf=fail smtp.mailfrom=dhl-versand.top"
    )
    # the body keeps its line breaks, the NUL padding is gone
    assert mail.get_body(("plain",)).get_content() == "Bitte bezahlen.\nDanke\n"
    assert "evil.top" in mail.get_body(("html",)).get_content()


def test_attachments_are_found_by_iter_attachments(fake_msg):
    fake_msg["msg"] = FakeMsg(
        attachments=[
            FakeAttachment("rechnung.pdf.exe", b"MZ program"),
            FakeAttachment("notiz.txt", b"plain text"),
        ]
    )

    mail = parse(msg_to_eml(MSG_BYTES))

    # the job and the attachment check only look with iter_attachments
    assert [
        (part.get_filename(), part.get_payload(decode=True))
        for part in mail.iter_attachments()
    ] == [("rechnung.pdf.exe", b"MZ program"), ("notiz.txt", b"plain text")]


def test_draft_without_headers_uses_subject_and_sender(fake_msg):
    fake_msg["msg"] = FakeMsg(
        headers=None, subject="Entwurf\x00\x00", sender="anna@firma.de"
    )

    mail = parse(msg_to_eml(MSG_BYTES))

    assert mail["Subject"] == "Entwurf"
    assert mail["From"] == "anna@firma.de"


def test_unreadable_msg_raises_msg_error(monkeypatch):
    def broken(file):
        raise ValueError("incorrect DllVersion in OLE header")

    monkeypatch.setattr(outlook_msg.extract_msg, "openMsg", broken)

    with pytest.raises(MsgError):
        msg_to_eml(MSG_BYTES)


# Upload


@pytest.mark.asyncio
async def test_upload_of_msg_stores_the_converted_eml(db, api, storage, fake_msg):
    stored, queued = storage
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.post(
        "/analyses",
        files={"file": ("mail.msg", MSG_BYTES, "application/vnd.ms-outlook")},
    )

    assert response.status_code == 200
    assert response.json()["subject"] == "Ihre Rechnung"
    assert response.json()["sender"] == "DHL <rechnung@dhl-versand.top>"
    # MinIO gets the .eml, not the .msg
    assert not is_msg(stored["key"])
    assert parse(stored["key"])["Subject"] == "Ihre Rechnung"
    assert queued == [response.json()["id"]]


@pytest.mark.asyncio
async def test_upload_of_unreadable_msg_is_rejected(db, api, storage, monkeypatch):
    stored, queued = storage
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    def broken(file):
        raise ValueError("broken")

    monkeypatch.setattr(outlook_msg.extract_msg, "openMsg", broken)

    response = await api.post("/analyses", files={"file": ("mail.msg", MSG_BYTES)})

    assert response.status_code == 422
    assert response.json()["detail"] == "Die .msg-Datei kann nicht gelesen werden"
    assert (stored, queued) == ({}, [])


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "content",
    [b"%PDF-1.4 eine Rechnung", b"nur ein Text", b"Subject: ohne Absender\n\nHallo"],
)
async def test_upload_of_something_else_than_a_mail_is_rejected(
    db, api, storage, content
):
    stored, queued = storage
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.post("/analyses", files={"file": ("mail.eml", content)})

    assert response.status_code == 422
    assert response.json()["detail"] == "Die Datei ist keine E-Mail"
    # nothing lands in MinIO or the queue
    assert (stored, queued) == ({}, [])


# Outlook report with the original attached as .msg


def report_with_attachment(filename: str, content: bytes) -> bytes:
    report = EmailMessage()
    report["From"] = "mitarbeiter@firma.de"
    report["Subject"] = "Phishing melden"
    report.set_content("Siehe Anhang")
    report.add_attachment(
        content, maintype="application", subtype="vnd.ms-outlook", filename=filename
    )
    return report.as_bytes()


def test_report_with_msg_attachment_gives_the_original(fake_msg):
    original = parse(extract_eml(report_with_attachment("mail.msg", MSG_BYTES)))

    assert original["Subject"] == "Ihre Rechnung"


def test_report_with_unreadable_msg_falls_back_to_the_report(monkeypatch):
    def broken(file):
        raise ValueError("broken")

    monkeypatch.setattr(outlook_msg.extract_msg, "openMsg", broken)
    raw = report_with_attachment("mail.msg", MSG_BYTES)

    assert extract_eml(raw) == raw
