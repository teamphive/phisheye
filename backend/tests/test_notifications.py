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
