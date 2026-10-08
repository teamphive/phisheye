import pytest

from app.models.mail_analysis import MailAnalysis
from app.services import detection
from app.services.notifications import (
    defang,
    is_notifiable,
    render_failed,
    render_invitation,
    render_received,
    render_result,
    send_failure_mail,
    send_verdict_mail,
)


def test_send_analysis_mail_requires_smtp_credentials(monkeypatch):
    monkeypatch.delenv("SMTP_USERNAME", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)

    analysis = MailAnalysis(team_id=1, submitted_by=1, subject="s", sender="x")

    with pytest.raises(RuntimeError):
        send_verdict_mail("a@example.com", analysis, "phishing")


def test_render_received_escapes_mail_content():
    analysis = MailAnalysis(
        id=1, team_id=1, submitted_by=1, subject="<script>x</script>", sender="a@b.de"
    )

    _, _, html = render_received(analysis)

    assert "<script>x</script>" not in html
    assert "&lt;script&gt;" in html


def test_is_notifiable_rejects_loops_and_bounces(monkeypatch):
    monkeypatch.setenv("SMTP_USERNAME", "report@example.com")

    assert is_notifiable("max@firma.de")
    assert not is_notifiable("report@example.com")
    assert not is_notifiable("MAILER-DAEMON@firma.de")
    assert not is_notifiable("kein-at-zeichen")


def sent_by(monkeypatch):
    sent = []
    monkeypatch.setattr(
        "app.services.notifications._send",
        lambda to, subject, text, html: sent.append((subject, text, html)),
    )

    return sent


def test_result_mail_names_the_checks_that_fired(monkeypatch):
    sent = sent_by(monkeypatch)
    analysis = MailAnalysis(
        id=1,
        team_id=1,
        submitted_by=1,
        subject="Rechnung",
        sender="a@b.de",
        verdict="phishing",
        criteria=[
            {
                "name": detection.AUTH_FAILED,
                "finding": "spf=fail",
                "weight": 40,
            },
            {
                "name": detection.SENDER_MISMATCH,
                "finding": "andere Domain",
                "weight": 0,
            },
        ],
    )

    send_verdict_mail("max@firma.de", analysis, "phishing")

    (_, text, html) = sent[0]
    assert "Absender nicht bestätigt" in text
    assert "Absender nicht bestätigt" in html
    # the auth results mean nothing to a reporter
    assert "spf=fail" not in html
    # a check that did not fire is no reason
    assert "Absender passt nicht zusammen" not in text
    assert "nicht angeschlagen" not in text


def test_a_harmless_verdict_comes_without_reasons(monkeypatch):
    sent = sent_by(monkeypatch)
    analysis = MailAnalysis(
        id=1,
        team_id=1,
        submitted_by=1,
        subject="Gruß",
        sender="a@b.de",
        verdict="clean",
        criteria=[{"name": "Anhang", "finding": "ok", "weight": 0}],
    )

    send_verdict_mail("max@firma.de", analysis, "clean")

    # a harmless mail has no reasons section at all
    assert "Was uns aufgefallen ist" not in sent[0][1]
    assert "Was uns aufgefallen ist" not in sent[0][2]


def test_a_failed_analysis_sends_the_failure_mail(monkeypatch):
    sent = sent_by(monkeypatch)
    analysis = MailAnalysis(
        id=1,
        team_id=1,
        submitted_by=1,
        subject="<b>Rechnung</b>",
        sender="a@b.de",
        status="failed",
    )

    send_failure_mail("max@firma.de", analysis)

    subject, text, html = sent[0]
    assert subject == "Nicht geprüft: <b>Rechnung</b>"
    assert "Melde die Mail bitte" in text
    # the subject comes from a foreign mail and stays escaped
    assert "<b>Rechnung</b>" not in html
    assert render_failed(analysis)[0] == subject


def test_the_decision_wins_over_the_automatic_verdict(monkeypatch):
    sent = sent_by(monkeypatch)
    analysis = MailAnalysis(
        id=1,
        team_id=1,
        submitted_by=1,
        subject="Rechnung",
        sender="a@b.de",
        verdict="phishing",
        criteria=[{"name": "Authentifizierung", "finding": "spf=fail", "weight": 40}],
    )

    # the analyst found a false alarm: harmless, and no reasons of the alarm
    send_verdict_mail("max@firma.de", analysis, "clean")

    subject, text, _ = sent[0]
    assert subject == "Legitim: Rechnung"
    assert "spf=fail" not in text


def test_a_correction_says_so(monkeypatch):
    sent = sent_by(monkeypatch)
    analysis = MailAnalysis(
        id=1,
        team_id=1,
        submitted_by=1,
        subject="Rechnung",
        sender="a@b.de",
        verdict="clean",
        criteria=[],
    )

    send_verdict_mail("max@firma.de", analysis, "phishing", correction=True)

    subject, text, html = sent[0]
    assert subject == "Neubewertung (Phishing): Rechnung"
    assert "Neubewertung" in text
    assert "Neubewertung" in html


def phishing_reasons():
    return [
        {"name": detection.AUTH_FAILED, "finding": "spf=fail · dkim=fail"},
        {
            "name": detection.LINK_MISMATCH,
            "finding": "„Rechnung“ → t.co-redirect.click",
        },
    ]


def reported_mail(**fields):
    return MailAnalysis(
        id=1,
        team_id=1,
        submitted_by=1,
        subject="Ihre Rechnung ist überfällig",
        sender="DHL <buchhaltung@dhl-versand-tracking.top>",
        **fields,
    )


def test_defang_breaks_domains_and_urls_only():
    assert (
        defang("buchhaltung@dhl-versand-tracking.top")
        == "buchhaltung@dhl-versand-tracking[.]top"
    )
    assert (
        defang("https://t.co-redirect.click/r") == "hxxps://t[.]co-redirect[.]click/r"
    )
    # no known suffix: file names and initials stay readable
    assert defang("Rechnung_RE-2024.pdf.htm") == "Rechnung_RE-2024.pdf.htm"
    assert defang("M. Sandmann") == "M. Sandmann"


def test_result_mail_explains_the_checks_in_plain_words():
    subject, text, html = render_result(reported_mail(), phishing_reasons(), "phishing")

    assert "Link führt woanders hin" in html
    assert "Link führt woanders hin" in text
    assert "t[.]co-redirect[.]click" in html
    assert "t.co-redirect.click" not in html


def test_result_mail_names_the_reported_mail_and_thanks():
    subject, text, html = render_result(reported_mail(), phishing_reasons(), "phishing")

    assert subject == "Phishing: Ihre Rechnung ist überfällig"
    assert "dhl-versand-tracking[.]top" in html
    assert "dhl-versand-tracking.top" not in html
    assert "Danke" in html
    assert "Danke" in text


def test_result_mail_says_an_analyst_decided():
    for verdict in ("phishing", "clean"):
        _, text, html = render_result(reported_mail(), [], verdict)

        assert "Security-Team" in text
        assert "Security-Team" in html


def test_phishing_without_triggered_checks_was_confirmed_by_hand():
    _, text, html = render_result(reported_mail(), [], "phishing")

    assert "Security-Team hat die Mail selbst als Phishing erkannt" in text
    assert "Security-Team hat die Mail selbst als Phishing erkannt" in html


def test_there_is_no_mail_for_the_automatic_suspicious_verdict():
    with pytest.raises(KeyError):
        render_result(reported_mail(verdict="suspicious"), [], "suspicious")


def test_subject_line_stays_short_and_on_one_line():
    analysis = reported_mail()
    analysis.subject = "Wichtig:\n" + "sehr " * 30 + "langer Betreff"

    subject, _, _ = render_result(analysis, [], "phishing")

    assert "\n" not in subject
    assert len(subject) <= len("Phishing: ") + 60
    assert subject.endswith("…")


def test_receipt_mail_without_subject_still_renders():
    analysis = MailAnalysis(
        id=1, team_id=1, submitted_by=1, subject="", sender="a@b.de"
    )

    subject, _, html = render_received(analysis)

    assert subject == "Meldung erhalten: (ohne Betreff)"
    assert "Danke für deine Meldung" in html


def test_invitation_names_how_long_the_setup_link_lasts():
    _, text, html = render_invitation("SOC", "Anna", "analyst", "https://x", True)

    assert "7 Tage gültig" in text
    assert "7 Tage gültig" in html
