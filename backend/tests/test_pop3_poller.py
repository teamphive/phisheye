from email.message import EmailMessage

from app.services.pop3_poller import extract_eml, extract_reporter


def test_extract_eml_unwraps_forwarded_message():
    raw_mail = (
        b"From: reporter@example.com\r\n"
        b"To: report@phisheye.internal\r\n"
        b"Subject: Fwd: phishing\r\n"
        b"Content-Type: message/rfc822\r\n"
        b"\r\n"
        b"From: attacker@example.com\r\n"
        b"To: victim@example.com\r\n"
        b"Subject: original phishing mail\r\n"
        b"\r\n"
        b"body\r\n"
    )

    result = extract_eml(raw_mail)

    assert b"Subject: original phishing mail" in result


def test_extract_eml_returns_input_unchanged_without_attachment():
    raw_mail = b"From: someone@example.com\r\nSubject: plain\r\n\r\nbody\r\n"

    assert extract_eml(raw_mail) == raw_mail


def test_extract_reporter_returns_sender_address():
    raw_mail = b"From: Max Muster <Max@Firma.de>\r\nSubject: Fwd\r\n\r\nbody\r\n"

    assert extract_reporter(raw_mail) == "max@firma.de"


def test_extract_reporter_ignores_auto_replies():
    raw_mail = b"From: max@firma.de\r\nAuto-Submitted: auto-replied\r\n\r\nbody\r\n"

    assert extract_reporter(raw_mail) is None


def test_extract_eml_unwraps_eml_attached_as_plain_file():
    from email.message import EmailMessage

    inner = (
        b"From: attacker@example.com\r\nSubject: original phishing mail\r\n\r\nbody\r\n"
    )
    outer = EmailMessage()
    outer["From"] = "reporter@example.com"
    outer["Subject"] = "WG: original phishing mail"
    outer.set_content("forwarded")
    outer.add_attachment(
        inner,
        maintype="application",
        subtype="octet-stream",
        filename="original phishing mail.eml",
    )

    assert extract_eml(outer.as_bytes()) == inner


def test_extract_eml_decodes_base64_message_rfc822():
    import base64

    inner = (
        b"From: attacker@example.com\r\nSubject: original phishing mail\r\n\r\nbody\r\n"
    )
    outer = (
        b"From: reporter@example.com\r\n"
        b"Subject: WG: original phishing mail\r\n"
        b'Content-Type: multipart/mixed; boundary="b"\r\n\r\n'
        b"--b\r\nContent-Type: text/plain\r\n\r\nforwarded\r\n"
        b'--b\r\nContent-Type: message/rfc822; name="x.eml"\r\n'
        b"Content-Transfer-Encoding: base64\r\n\r\n"
        + base64.encodebytes(inner)
        + b"--b--\r\n"
    )

    assert extract_eml(outer) == inner


def report_with_msg(msg_bytes: bytes) -> bytes:
    outer = EmailMessage()
    outer["From"] = "reporter@example.com"
    outer["Subject"] = "Fwd: phishing"
    outer.set_content("see attachment")
    outer.add_attachment(
        msg_bytes,
        maintype="application",
        subtype="vnd.ms-outlook",
        filename="Original.msg",
    )
    return outer.as_bytes()


def test_extract_eml_converts_a_forwarded_msg_attachment(monkeypatch):
    from app.services import pop3_poller

    monkeypatch.setattr(pop3_poller, "msg_to_eml", lambda content: b"converted")

    assert extract_eml(report_with_msg(b"\xd0\xcf\x11\xe0 msg")) == b"converted"


def test_extract_eml_keeps_the_report_when_the_msg_is_unreadable():
    # an OLE start with nothing behind it, extract-msg cannot open that
    raw_mail = report_with_msg(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64)

    # the report itself is analyzed instead of being dropped
    assert extract_eml(raw_mail) == raw_mail
