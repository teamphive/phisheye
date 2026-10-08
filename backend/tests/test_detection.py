from email.message import EmailMessage

from app.services.detection import (
    check_attachments,
    check_authentication,
    check_links,
    check_sender,
    detect,
    extract_links,
    verdict_for,
)


def mail(
    *,
    sender="Paypal <service@paypal.com>",
    headers: dict | None = None,
    html: str | None = None,
    text="Hallo",
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = sender
    message["Subject"] = "Test"

    for name, value in (headers or {}).items():
        message[name] = value

    message.set_content(text)

    if html is not None:
        message.add_alternative(html, subtype="html")

    return message


def with_attachment(filename: str, content: bytes) -> EmailMessage:
    message = mail()
    message.add_attachment(
        content, maintype="application", subtype="octet-stream", filename=filename
    )
    return message


# 1. Authentifizierung


def test_failed_spf_triggers():
    result = check_authentication(
        mail(
            headers={
                "Authentication-Results": "mx.firma.de; spf=fail smtp.mailfrom=x.top;"
                " dkim=pass header.d=x.top; dmarc=fail"
            }
        )
    )

    assert result["weight"] == 40
    assert result["finding"] == "spf=fail · dkim=pass · dmarc=fail"


def test_passed_authentication_does_not_trigger():
    result = check_authentication(
        mail(headers={"Authentication-Results": "mx; spf=pass; dkim=pass; dmarc=pass"})
    )

    assert result["weight"] == 0


def test_missing_header_is_not_assessable_and_not_passed():
    result = check_authentication(mail())

    assert result["weight"] == 0
    assert "nicht bewertbar" in result["finding"]


def test_only_the_topmost_header_counts():
    message = mail(headers={"Authentication-Results": "mx.firma.de; spf=fail"})
    # added further down by the attacker's own server
    message["Authentication-Results"] = "evil; spf=pass"

    assert check_authentication(message)["weight"] == 40


# 2. Links


def test_link_text_with_other_domain_is_phishing():
    links = extract_links(
        mail(html='<a href="https://paypal-login.top/x">www.paypal.com</a>')
    )

    assert links[0]["tone"] == "phishing"
    assert links[0]["host"] == "paypal-login.top"
    assert check_links(links)["weight"] == 30


def test_subdomain_of_the_shown_domain_is_fine():
    links = extract_links(
        mail(html='<a href="https://www.paypal.com/login">paypal.com</a>')
    )

    assert links[0]["tone"] == "clean"
    assert check_links(links)["weight"] == 0


def test_normal_link_text_is_fine():
    links = extract_links(
        mail(html='<a href="https://shop.example.com">Zum <b>Shop</b></a>')
    )

    assert links[0]["text"] == "Zum Shop"
    assert links[0]["tone"] == "clean"


def test_ip_instead_of_domain_triggers():
    links = extract_links(mail(html='<a href="http://185.203.118.44/x">Abmelden</a>'))

    assert links[0]["finding"] == "IP statt Domain"
    assert links[0]["tone"] == "suspicious"
    assert check_links(links)["weight"] == 30


def test_mailto_and_anchors_are_skipped():
    links = extract_links(
        mail(html='<a href="mailto:a@b.de">Mail</a><a href="#top">Oben</a>')
    )

    assert links == []


def test_plain_text_links_are_found():
    links = extract_links(mail(text="Hier klicken: http://10.0.0.1/login bitte"))

    assert links[0]["target"] == "http://10.0.0.1/login"
    assert links[0]["tone"] == "suspicious"


# 3. Anhänge


def test_double_extension_triggers():
    result = check_attachments(with_attachment("rechnung.pdf.exe", b"MZ..."))

    assert result["weight"] == 30
    assert "doppelte Endung" in result["finding"]


def test_program_with_harmless_extension_triggers():
    result = check_attachments(with_attachment("foto.jpg", b"MZ\x90\x00"))

    assert result["weight"] == 30


def test_pdf_that_is_no_pdf_triggers():
    result = check_attachments(with_attachment("rechnung.pdf", b"<html>"))

    assert result["finding"] == "rechnung.pdf ist keine echte .pdf-Datei"


def test_real_pdf_does_not_trigger():
    result = check_attachments(with_attachment("rechnung.pdf", b"%PDF-1.4 ..."))

    assert result["weight"] == 0


# 4. Absender


def test_reply_to_with_other_domain_triggers():
    result = check_sender(
        mail(
            sender="DHL <rechnung@dhl-versand.top>",
            headers={"Reply-To": "billing@mail-reply-service.top"},
        )
    )

    assert result["weight"] == 20
    assert result["finding"] == "mail-reply-service.top statt dhl-versand.top"


def test_return_path_on_a_subdomain_is_fine():
    result = check_sender(
        mail(
            sender="DHL <rechnung@dhl.de>",
            headers={"Return-Path": "<bounce@srv14.dhl.de>"},
        )
    )

    assert result["weight"] == 0


def test_empty_return_path_is_ignored():
    result = check_sender(mail(headers={"Return-Path": "<>"}))

    assert result["weight"] == 0


# Gesamt


def test_thresholds():
    assert verdict_for(0) == "clean"
    assert verdict_for(39) == "clean"
    assert verdict_for(40) == "suspicious"
    assert verdict_for(74) == "suspicious"
    assert verdict_for(75) == "phishing"


def test_score_is_capped_at_100():
    message = mail(
        sender="DHL <rechnung@dhl-versand.top>",
        headers={
            "Authentication-Results": "mx; spf=fail",
            "Reply-To": "billing@mail-reply-service.top",
        },
        html='<a href="https://evil.top">dhl.de</a>',
    )
    message.add_attachment(
        b"MZ", maintype="application", subtype="octet-stream", filename="a.pdf.exe"
    )

    detection = detect(message)

    assert sum(criterion["weight"] for criterion in detection.criteria) == 120
    assert detection.score == 100
    assert detection.verdict == "phishing"


def test_harmless_mail_is_clean():
    detection = detect(mail())

    assert len(detection.criteria) == 4
    assert detection.score == 0
    assert detection.verdict == "clean"
