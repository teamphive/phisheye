import pytest


@pytest.fixture(autouse=True)
def no_real_jev(monkeypatch):
    """No test may ask the real JEV, a key in .env would cost money.

    Tests that need a key set one themselves and fake the HTTP layer.
    """
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
