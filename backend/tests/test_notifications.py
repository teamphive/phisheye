import pytest

from app.models.mail_analysis import MailAnalysis
from app.services.notifications import (
    is_notifiable,
    render_received,
    send_analysis_mail,
)


def test_send_analysis_mail_requires_smtp_credentials(monkeypatch):
    monkeypatch.delenv("SMTP_USERNAME", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)

    analysis = MailAnalysis(team_id=1, submitted_by=1, subject="s", sender="x")

    with pytest.raises(RuntimeError):
        send_analysis_mail("a@example.com", analysis)


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
                "name": "Authentifizierung fehlgeschlagen",
                "finding": "spf=fail",
                "weight": 40,
            },
            {
                "name": "From weicht von Reply-To ab",
                "finding": "andere Domain",
                "weight": 0,
            },
        ],
    )

    send_analysis_mail("max@firma.de", analysis)

    (_, text, html) = sent[0]
    assert "Authentifizierung fehlgeschlagen: spf=fail" in text
    assert "spf=fail" in html
    # a check that did not fire is no reason
    assert "Reply-To" not in text
    assert "Keine der Prüfungen" not in text


def test_result_mail_of_a_clean_mail_says_nothing_fired(monkeypatch):
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

    send_analysis_mail("max@firma.de", analysis)

    assert "Keine der Prüfungen hat ausgelöst." in sent[0][1]
