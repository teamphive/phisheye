# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import pytest
from test_analyze import add, db  # noqa: F401
from test_team import team_with

from app.models.mail_analysis import MailAnalysis
from app.services import mail_analysis, notifications
from app.worker import tasks


class FakeRedis:
    def __init__(self):
        self.jobs = []

    async def enqueue_job(self, name, *args, **kwargs):
        self.jobs.append((name, args, kwargs))


async def reported_analysis(db, reported_by="max@firma.de", status="pending"):
    team, (admin,) = await team_with(db, "admin")
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team.id,
            submitted_by=admin.id,
            subject="Rechnung",
            sender="x@example.com",
            reported_by=reported_by,
            status=status,
        ),
    )

    return analysis.id


def use_session(monkeypatch, db):
    async def session():
        yield db

    monkeypatch.setattr(tasks, "get_session", session)


def finish_analysis(monkeypatch, db, status="completed"):
    async def run(analysis_id, session):
        async with session.begin():
            analysis = await session.get(MailAnalysis, analysis_id)
            analysis.status = status
            analysis.verdict = "phishing"
            session.add(analysis)

    monkeypatch.setattr(tasks, "run_analysis", run)


@pytest.mark.asyncio
async def test_submit_queues_the_analysis_but_not_the_mail(db, monkeypatch):
    queued = []

    class Pool:
        async def enqueue_job(self, name, *args, **kwargs):
            queued.append(name)

        async def aclose(self):
            pass

    async def pool(_):
        return Pool()

    async def store(content):
        return "key"

    monkeypatch.setattr(mail_analysis, "create_pool", pool)
    monkeypatch.setattr(notifications, "create_pool", pool)
    monkeypatch.setattr(mail_analysis, "store_eml", store)
    team, (admin,) = await team_with(db, "admin")
    eml = b"From: a@example.com\r\nDate: Mon, 1 Oct 2026 10:00:00 +0000\r\n\r\nHi"

    await mail_analysis.submit_analysis(
        content=eml,
        team_id=team.id,
        submitted_by=admin.id,
        db=db,
        reported_by="max@firma.de",
    )

    # the mail would race the analysis, it follows once the analysis is done
    assert queued == ["analyze_mail"]


@pytest.mark.asyncio
async def test_result_mail_is_queued_after_the_analysis(db, monkeypatch):
    analysis_id = await reported_analysis(db)
    use_session(monkeypatch, db)
    finish_analysis(monkeypatch, db)
    redis = FakeRedis()

    await tasks.analyze_mail({"job_try": 1, "redis": redis}, analysis_id)

    assert redis.jobs == [
        (
            "send_analysis_ready",
            (analysis_id,),
            {"_job_id": f"analysis-ready-{analysis_id}"},
        )
    ]


@pytest.mark.asyncio
async def test_an_upload_gets_no_mail(db, monkeypatch):
    analysis_id = await reported_analysis(db, reported_by=None)
    use_session(monkeypatch, db)
    finish_analysis(monkeypatch, db)
    redis = FakeRedis()

    await tasks.analyze_mail({"job_try": 1, "redis": redis}, analysis_id)

    assert redis.jobs == []


@pytest.mark.asyncio
async def test_a_failed_analysis_sends_no_mail(db, monkeypatch):
    analysis_id = await reported_analysis(db)
    use_session(monkeypatch, db)
    redis = FakeRedis()

    async def run(analysis_id, session):
        raise RuntimeError("boom")

    async def record(*args):
        pass

    monkeypatch.setattr(tasks, "run_analysis", run)
    monkeypatch.setattr(tasks, "record_failure", record)

    # the last try ends the job quietly, no retry and no mail
    await tasks.analyze_mail(
        {"job_try": tasks.MAX_ANALYSIS_TRIES, "redis": redis}, analysis_id
    )

    assert redis.jobs == []


@pytest.mark.asyncio
async def test_the_mail_job_does_nothing_before_the_analysis_is_done(db, monkeypatch):
    analysis_id = await reported_analysis(db, status="processing")
    use_session(monkeypatch, db)
    sent = []
    monkeypatch.setattr(tasks, "send_analysis_mail", lambda *a: sent.append(a))

    await tasks.send_analysis_ready({"job_try": 1}, analysis_id)

    analysis = await db.get(MailAnalysis, analysis_id)
    # no receipt mail, and the one result mail is still possible later
    assert sent == []
    assert analysis.notified_at is None


@pytest.mark.asyncio
async def test_the_mail_job_sends_the_result_once_the_analysis_is_done(db, monkeypatch):
    analysis_id = await reported_analysis(db, status="completed")
    use_session(monkeypatch, db)
    sent = []
    monkeypatch.setattr(tasks, "send_analysis_mail", lambda *a: sent.append(a))

    await tasks.send_analysis_ready({"job_try": 1}, analysis_id)

    analysis = await db.get(MailAnalysis, analysis_id)
    assert len(sent) == 1
    assert analysis.notified_at is not None
