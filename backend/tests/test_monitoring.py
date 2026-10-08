# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime, timedelta

import pytest
from test_analyze import add, api, db, login_as, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.models.user import User
from app.routes import monitoring as monitoring_route
from app.services import mail_analysis, monitoring


class FakeRedis:
    """The few Redis commands the monitoring uses, kept in a dict."""

    def __init__(self, data: dict):
        self.data = data

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def incr(self, key):
        await self.incrby(key, 1)

    async def incrby(self, key, amount):
        self.data[key] = self.data.get(key, 0) + amount

    async def expire(self, key, seconds):
        pass

    async def get(self, key):
        return self.data.get(key)

    async def exists(self, key):
        return int(key in self.data)

    async def ping(self):
        return True


@pytest.fixture
def redis(monkeypatch):
    data = {monitoring.WORKER_HEALTH_KEY: "running"}
    monkeypatch.setattr(monitoring, "_redis", lambda: FakeRedis(data))
    monkeypatch.setattr(monitoring, "_minio_reachable", lambda: True)
    monkeypatch.setenv("VT_API_KEY", "key")
    monkeypatch.setenv("TYPESAFE_API_KEY", "key")
    return data


@pytest.fixture
def requeued(monkeypatch):
    calls = []

    async def requeue(analysis_id):
        calls.append(analysis_id)

    monkeypatch.setattr(monitoring_route, "requeue_analysis", requeue)
    return calls


async def operator(db) -> User:
    (user,) = await add(
        db,
        User(email="ops@example.com", name="Ops", password_hash="", is_operator=True),
    )
    return user


def failed(team, user, at: datetime, detail="VirusTotal-Kontingent überschritten"):
    return MailAnalysis(
        team_id=team.id,
        submitted_by=user.id,
        subject="Geheimer Betreff",
        sender="geheim@example.com",
        status="failed",
        created_at=at,
        error={
            "detail": detail,
            "step": "Anhänge werden geprüft",
            "attempt": 3,
            "max_attempts": 3,
            "at": at.isoformat(),
        },
    )


# Access


@pytest.mark.asyncio
async def test_only_operators(db, api, redis):
    _, _, anna, _, analysis_b = await two_teams(db)
    login_as(anna)

    assert (await api.get("/monitoring")).status_code == 403
    assert (
        await api.post(f"/monitoring/jobs/{analysis_b.id}/retry")
    ).status_code == 403


# GET /monitoring


@pytest.mark.asyncio
async def test_monitoring_over_all_teams(db, api, redis):
    team_a, team_b, anna, ben, _ = await two_teams(db)
    now = datetime.utcnow()
    await add(
        db,
        MailAnalysis(
            team_id=team_a.id,
            submitted_by=anna.id,
            subject="a",
            sender="a@x.de",
            status="completed",
        ),
        MailAnalysis(
            team_id=team_b.id,
            submitted_by=ben.id,
            subject="b",
            sender="b@x.de",
            status="processing",
        ),
        failed(team_b, ben, now - timedelta(hours=2)),
        # older than 24 hours, not counted
        failed(team_a, anna, now - timedelta(hours=30)),
    )
    redis[monitoring._vt_key(now)] = 412
    login_as(await operator(db))

    response = await api.get("/monitoring")

    assert response.status_code == 200
    data = response.json()
    # two_teams leaves one analysis of Team B pending
    assert data["queue"] == {"waiting": 1}
    assert data["workers"] == {"busy": 1, "total": 10}
    assert data["jobs"] == {"failed": 1, "total": 2}
    assert data["virus_total"] == {"used": 412, "limit": 500}


@pytest.mark.asyncio
async def test_hourly_has_24_hours_oldest_first(db, api, redis):
    team_a, _, anna, _, _ = await two_teams(db)
    now = datetime.utcnow()
    await add(
        db,
        *[
            MailAnalysis(
                team_id=team_a.id,
                submitted_by=anna.id,
                subject="x",
                sender="x@x.de",
                created_at=now - timedelta(hours=hours_ago),
            )
            for hours_ago in (0, 0, 5)
        ],
    )
    login_as(await operator(db))

    hourly = (await api.get("/monitoring")).json()["hourly"]

    assert len(hourly) == 24
    current = now.replace(minute=0, second=0, microsecond=0)
    assert hourly[-1]["hour"] == current.isoformat()
    assert hourly[0]["hour"] == (current - timedelta(hours=23)).isoformat()
    # the analysis of two_teams and two of ours in the current hour
    assert hourly[-1]["count"] == 3
    assert hourly[-6]["count"] == 1


@pytest.mark.asyncio
async def test_failures_carry_no_mail_content(db, api, redis):
    team_a, _, anna, _, _ = await two_teams(db)
    now = datetime.utcnow()
    older, newer = await add(
        db,
        failed(team_a, anna, now - timedelta(hours=5), detail="x" * 500),
        failed(team_a, anna, now - timedelta(hours=1)),
    )
    login_as(await operator(db))

    failures = (await api.get("/monitoring")).json()["failures"]

    # newest first
    assert [f["id"] for f in failures] == [newer.id, older.id]
    assert set(failures[0]) == {"id", "error", "attempt", "max_attempts", "at"}
    assert "Geheimer Betreff" not in str(failures)
    assert len(failures[1]["error"]) == monitoring.MAX_ERROR_CHARS


@pytest.mark.asyncio
async def test_services(db, api, redis, monkeypatch):
    await two_teams(db)
    login_as(await operator(db))

    async def services_of_api():
        return (await api.get("/monitoring")).json()["services"]

    services = await services_of_api()
    assert {s["name"]: s["status"] for s in services} == {
        "API (FastAPI)": "ok",
        "PostgreSQL": "ok",
        "Redis": "ok",
        "Worker": "ok",
        "MinIO": "ok",
        "VirusTotal-API": "ok",
        "JEV (TypeSafe)": "ok",
    }

    # worker stopped, MinIO gone, no JEV key, VirusTotal at 90 %
    del redis[monitoring.WORKER_HEALTH_KEY]

    def no_minio():
        raise OSError("connection refused")

    monkeypatch.setattr(monitoring, "_minio_reachable", no_minio)
    monkeypatch.delenv("TYPESAFE_API_KEY")
    redis[monitoring._vt_key(datetime.utcnow())] = 450

    services = {s["name"]: s["status"] for s in await services_of_api()}
    assert services["Worker"] == "down"
    assert services["MinIO"] == "down"
    assert services["JEV (TypeSafe)"] == "degraded"
    assert services["VirusTotal-API"] == "degraded"


@pytest.mark.asyncio
async def test_redis_down_does_not_break_the_page(db, api, monkeypatch):
    await two_teams(db)
    monkeypatch.setattr(monitoring, "_minio_reachable", lambda: True)

    def broken():
        raise ConnectionError("no redis")

    monkeypatch.setattr(monitoring, "_redis", broken)
    login_as(await operator(db))

    response = await api.get("/monitoring")

    assert response.status_code == 200
    services = {s["name"]: s["status"] for s in response.json()["services"]}
    assert (services["Redis"], services["Worker"]) == ("down", "down")
    assert response.json()["virus_total"]["used"] == 0


# VirusTotal quota


@pytest.mark.asyncio
async def test_every_lookup_is_counted(redis, monkeypatch):
    class Client:
        async def get_object_async(self, path):
            raise mail_analysis.vt.APIError("NotFoundError", "unknown")

    await mail_analysis._virus_total(Client(), "a" * 64)
    await mail_analysis._virus_total(Client(), "b" * 64)

    assert await monitoring.vt_used() == 2


@pytest.mark.asyncio
async def test_counting_never_fails_the_lookup(monkeypatch):
    def broken():
        raise ConnectionError("no redis")

    monkeypatch.setattr(monitoring, "_redis", broken)

    # no exception, the analysis goes on
    await monitoring.count_vt_lookup()


# JEV usage


@pytest.mark.asyncio
async def test_jev_requests_and_tokens_are_added_up(db, api, redis):
    await monitoring.count_jev_usage(400_000)
    await monitoring.count_jev_usage(600_000)

    # 1 million input tokens at 0.042 dollars per million
    assert await monitoring.jev_usage() == {
        "requests": 2,
        "input_tokens": 1_000_000,
        "cost_usd": 0.042,
    }

    await two_teams(db)
    login_as(await operator(db))
    assert (await api.get("/monitoring")).json()["jev"]["requests"] == 2


@pytest.mark.asyncio
async def test_jev_usage_without_redis_is_zero(monkeypatch):
    def broken():
        raise ConnectionError("no redis")

    monkeypatch.setattr(monitoring, "_redis", broken)

    # counting does not raise, reading gives zeros
    await monitoring.count_jev_usage(500)
    assert await monitoring.jev_usage() == {
        "requests": 0,
        "input_tokens": 0,
        "cost_usd": 0.0,
    }


def test_limit_from_env(monkeypatch):
    monkeypatch.setenv("VT_DAILY_LIMIT", "20000")

    assert monitoring.vt_limit() == 20000


# POST /monitoring/jobs/{id}/retry


@pytest.mark.asyncio
async def test_retry_puts_a_failed_analysis_back(db, api, redis, requeued):
    team_a, _, anna, _, _ = await two_teams(db)
    (analysis,) = await add(db, failed(team_a, anna, datetime.utcnow()))
    login_as(await operator(db))

    response = await api.post(f"/monitoring/jobs/{analysis.id}/retry")

    assert response.status_code == 204
    assert requeued == [analysis.id]
    await db.refresh(analysis)
    assert (analysis.status, analysis.error, analysis.started_at) == (
        "pending",
        None,
        None,
    )


@pytest.mark.asyncio
async def test_only_failed_analyses_restart(db, api, redis, requeued):
    _, _, _, _, pending = await two_teams(db)
    login_as(await operator(db))

    assert (await api.post(f"/monitoring/jobs/{pending.id}/retry")).status_code == 409
    assert (await api.post("/monitoring/jobs/999/retry")).status_code == 404
    assert requeued == []


@pytest.mark.asyncio
async def test_retry_without_queue_stays_failed(db, api, redis, monkeypatch):
    team_a, _, anna, _, _ = await two_teams(db)
    (analysis,) = await add(db, failed(team_a, anna, datetime.utcnow()))

    async def no_queue(analysis_id):
        raise ConnectionError("no redis")

    monkeypatch.setattr(monitoring_route, "requeue_analysis", no_queue)
    login_as(await operator(db))

    response = await api.post(f"/monitoring/jobs/{analysis.id}/retry")

    assert response.status_code == 503
    await db.refresh(analysis)
    assert analysis.status == "failed"


@pytest.mark.asyncio
async def test_each_retry_gets_its_own_job_id(monkeypatch):
    job_ids = []

    class Pool:
        async def enqueue_job(self, name, analysis_id, _job_id):
            job_ids.append(_job_id)

        async def aclose(self):
            pass

    async def create_pool(settings):
        return Pool()

    monkeypatch.setattr(mail_analysis, "create_pool", create_pool)

    await mail_analysis.requeue_analysis(7)
    await mail_analysis.requeue_analysis(7)

    # arq refuses an id while the result of the failed job is kept
    assert len(set(job_ids)) == 2
    assert all(job_id.startswith("analysis-7-retry-") for job_id in job_ids)
