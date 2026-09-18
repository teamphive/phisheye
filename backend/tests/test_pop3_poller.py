from app.services.pop3_poller import extract_eml


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
