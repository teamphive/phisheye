import hashlib
import hmac

from app.services.mailgun import verify_mailgun_signature


def test_verify_mailgun_signature_accepts_valid_signature(monkeypatch):
    monkeypatch.setenv("MAILGUN_WEBHOOK_SIGNING_KEY", "secret")

    timestamp = "1234567890"
    token = "token-abc"
    signature = hmac.new(
        key=b"secret",
        msg=f"{timestamp}{token}".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    assert verify_mailgun_signature(timestamp, token, signature) is True


def test_verify_mailgun_signature_rejects_wrong_signature(monkeypatch):
    monkeypatch.setenv("MAILGUN_WEBHOOK_SIGNING_KEY", "secret")

    assert verify_mailgun_signature("1234567890", "token-abc", "wrong") is False
