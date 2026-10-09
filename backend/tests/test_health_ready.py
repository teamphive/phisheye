# ruff: noqa: F811  the fixtures come from other test files and are used by name
import pytest
from test_analyze import api, db  # noqa: F401
from test_monitoring import redis  # noqa: F401

from app.services import health, monitoring


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    """No remembered answer between tests, and a Keycloak that answers."""
    monkeypatch.setattr(health, "_cache", None)

    async def keycloak_up():
        return True

    monkeypatch.setattr(health, "_keycloak", keycloak_up)


@pytest.mark.asyncio
async def test_everything_up_is_ok_and_names_no_service(db, api, redis):
    response = await api.get("/health/ready")

    assert response.status_code == 200
    # public: one word, nothing about what runs behind the app
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_a_service_the_app_needs_down_is_503(db, api, redis, monkeypatch):
    def no_minio():
        raise OSError("connection refused")

    monkeypatch.setattr(monitoring, "_minio_reachable", no_minio)

    response = await api.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "down"}


@pytest.mark.asyncio
async def test_redis_down_is_503(db, api, redis, monkeypatch):
    async def broken(self):
        raise ConnectionError("down")

    monkeypatch.setattr(type(monitoring._redis()), "ping", broken)

    assert (await api.get("/health/ready")).status_code == 503


@pytest.mark.asyncio
async def test_a_stopped_worker_is_degraded_but_still_200(db, api, redis):
    del redis[monitoring.WORKER_HEALTH_KEY]

    response = await api.get("/health/ready")

    # the app answers, analyses only wait
    assert response.status_code == 200
    assert response.json() == {"status": "degraded"}


@pytest.mark.asyncio
async def test_keycloak_down_is_degraded_but_still_200(db, api, redis, monkeypatch):
    async def keycloak_down():
        return False

    monkeypatch.setattr(health, "_keycloak", keycloak_down)

    response = await api.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "degraded"}


@pytest.mark.asyncio
async def test_external_apis_never_count(db, api, redis, monkeypatch):
    # no keys: the monitoring page calls that degraded, readiness does not care
    monkeypatch.delenv("VT_API_KEY", raising=False)
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)

    assert (await api.get("/health/ready")).json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_the_answer_is_kept_for_a_few_seconds(db, api, redis, monkeypatch):
    calls = []
    real = health.readiness

    async def counted(db):
        calls.append(1)
        return await real(db)

    monkeypatch.setattr(health, "readiness", counted)

    await api.get("/health/ready")
    await api.get("/health/ready")
    assert len(calls) == 1

    # once the time is up it looks again
    monkeypatch.setattr(health, "CACHE_SECONDS", 0)
    await api.get("/health/ready")
    assert len(calls) == 2


def test_overall_follows_the_rules():
    def states(**kw):
        base = {"PostgreSQL": "ok", "Redis": "ok", "MinIO": "ok", "Worker": "ok"}
        return [{"name": n, "status": s} for n, s in {**base, **kw}.items()]

    assert health.overall(states()) == "ok"
    assert health.overall(states(Worker="down")) == "degraded"
    assert health.overall(states(Keycloak="down")) == "degraded"
    assert health.overall(states(PostgreSQL="down")) == "down"
    # one critical service wins over a degraded one
    assert health.overall(states(Worker="down", Redis="down")) == "down"


@pytest.mark.asyncio
async def test_plain_health_does_not_look_at_anything(db, api, monkeypatch):
    def no_minio():
        raise OSError("connection refused")

    monkeypatch.setattr(monitoring, "_minio_reachable", no_minio)

    # liveness stays free of dependencies, so a blip never looks like a dead app
    response = await api.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
