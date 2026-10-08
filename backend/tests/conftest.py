import pytest


@pytest.fixture(autouse=True)
def no_real_jev(monkeypatch):
    """No test may ask the real JEV, a key in .env would cost money.

    Tests that need a key set one themselves and fake the HTTP layer.
    """
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)


@pytest.fixture(autouse=True)
def no_real_redis(monkeypatch):
    """A Redis from `just dev` must not see test data, e.g. the VirusTotal
    counter. Port 1 refuses at once, tests that need Redis fake it."""
    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:1/0")
