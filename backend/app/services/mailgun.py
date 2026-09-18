import hashlib
import hmac
import os


def verify_mailgun_signature(timestamp: str, token: str, signature: str) -> bool:
    signing_key = os.getenv("MAILGUN_WEBHOOK_SIGNING_KEY")

    if not signing_key:
        return False

    expected = hmac.new(
        key=signing_key.encode("utf-8"),
        msg=f"{timestamp}{token}".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)
