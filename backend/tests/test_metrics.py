# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import pytest
from prometheus_client import REGISTRY
from test_analyze import api, db  # noqa: F401


def requests(handler: str, status: str) -> float:
    labels = {"handler": handler, "method": "GET", "status": status}
    return REGISTRY.get_sample_value("http_requests_total", labels) or 0.0


@pytest.mark.asyncio
async def test_requests_are_counted_by_handler_and_status(db, api):
    before = requests("/analyses", "4xx")

    response = await api.get("/analyses")

    assert response.status_code == 401
    assert requests("/analyses", "4xx") == before + 1


@pytest.mark.asyncio
async def test_health_checks_are_not_counted(db, api):
    before = requests("/health", "2xx")

    await api.get("/health")

    assert requests("/health", "2xx") == before
