from email import policy
from email.message import Message
from email.parser import BytesParser
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import msg_convert
from app.services.eml_validation import InvalidEmlError, check_eml
from app.services.msg_convert import is_msg, msg_to_eml

OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def fake_msg(**fields):
    defaults = {
        "header": None,
        "subject": "Hallo",
        "sender": "Anna <anna@example.com>",
        "date": None,
        "to": "ben@example.com",
        "body": "Text",
        "htmlBody": None,
        "attachments": [],
        "close": lambda: None,
    }
    return SimpleNamespace(**{**defaults, **fields})


def convert(monkeypatch, source):
    monkeypatch.setattr(msg_convert.extract_msg, "openMsg", lambda _: source)
    eml = msg_to_eml(OLE + b"rest")

    return eml, BytesParser(policy=policy.default).parsebytes(eml)


def test_ole_signature_marks_a_msg():
    assert is_msg(OLE + b"anything")
    assert not is_msg(b"From: a@b.de\r\n\r\nHi")
    assert not is_msg(b"%PDF-1.7")


def test_transport_headers_survive_the_conversion(monkeypatch):
    header = Message()
    header["Received"] = "from mx.example.com\r\n by mail.example.org"
    header["From"] = "Anna <anna@example.com>"
    header["Authentication-Results"] = "mx; spf=fail"
    header["Content-Type"] = "multipart/mixed"

    eml, mail = convert(monkeypatch, fake_msg(header=header))

    assert mail["Authentication-Results"] == "mx; spf=fail"
    # a folded header becomes one line
    assert mail["Received"] == "from mx.example.com by mail.example.org"
    assert mail["From"] == "Anna <anna@example.com>"
    check_eml(eml, mail)


def test_a_draft_without_transport_headers_gets_the_basic_ones(monkeypatch):
    eml, mail = convert(monkeypatch, fake_msg(subject="Grüße\x00\x00", date=None))

    assert mail["Subject"] == "Grüße"
    assert mail["From"] == "Anna <anna@example.com>"
    check_eml(eml, mail)


def test_attachments_are_found_like_in_any_other_mail(monkeypatch):
    attachment = SimpleNamespace(
        data=b"payload", longFilename="rechnung.pdf", shortFilename=None, mimetype=None
    )
    nested = SimpleNamespace(
        data=object(), longFilename="inner.msg", shortFilename=None, mimetype=None
    )

    _, mail = convert(monkeypatch, fake_msg(attachments=[attachment, nested]))

    found = [
        (part.get_filename(), part.get_payload(decode=True))
        for part in mail.iter_attachments()
    ]
    # a nested message has no bytes to look at and is left out
    assert found == [("rechnung.pdf", b"payload")]


def test_nul_bytes_in_attachment_names_and_types_are_dropped(monkeypatch):
    # Outlook pads these fields with NUL, Postgres refuses them
    attachment = SimpleNamespace(
        data=b"png",
        longFilename="ATT00001.png\x00",
        shortFilename=None,
        mimetype="image/png\x00",
    )

    _, mail = convert(monkeypatch, fake_msg(attachments=[attachment]))

    (part,) = list(mail.iter_attachments())
    assert part.get_filename() == "ATT00001.png"
    assert part.get_content_type() == "image/png"


def test_a_field_that_raises_does_not_stop_the_conversion(monkeypatch):
    class Broken:
        header = None
        subject = "Hallo"
        sender = "anna@example.com"
        date = None
        body = "Text"
        htmlBody = None
        attachments = []

        @property
        def to(self):
            raise UnicodeDecodeError("gb2312", b"\xea", 0, 1, "bad")

        def close(self):
            pass

    _, mail = convert(monkeypatch, Broken())

    assert mail["Subject"] == "Hallo"
    assert mail["To"] is None


def test_a_file_that_is_no_msg_is_rejected(monkeypatch):
    def broken(_):
        raise ValueError("not an msg")

    monkeypatch.setattr(msg_convert.extract_msg, "openMsg", broken)

    with pytest.raises(InvalidEmlError) as error:
        msg_to_eml(OLE + b"\x00" * 600)

    assert isinstance(error.value, HTTPException)
    assert error.value.status_code == 422
