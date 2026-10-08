# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime, timedelta

import pytest
from test_analyze import add, api, db, login_as  # noqa: F401
from test_team import team_with

from app.constants import DECISION_MAIL_DELAY_SECONDS
from app.models.mail_analysis import MailAnalysis
from app.routes import analyze
from app.worker import tasks

LONG_AGO = timedelta(seconds=DECISION_MAIL_DELAY_SECONDS + 60)


async def decided_analysis(
    db,
    decided_verdict="phishing",
    notified_verdict=None,
    decided_ago=LONG_AGO,
    reported_by="max@firma.de",
):
    team, (admin,) = await team_with(db, "admin")
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team.id,
            submitted_by=admin.id,
            subject="Rechnung",
            sender="x@example.com",
            reported_by=reported_by,
            status="completed",
            verdict="phishing",
            decided_verdict=decided_verdict,
            decided_by=admin.id if decided_verdict else None,
            decided_at=datetime.utcnow() - decided_ago if decided_verdict else None,
            notified_verdict=notified_verdict,
        ),
    )

    return analysis.id, admin


def capture_mails(monkeypatch, db):
    async def session():
        yield db

    sent = []
    monkeypatch.setattr(tasks, "get_session", session)
    monkeypatch.setattr(tasks, "send_verdict_mail", lambda *a: sent.append(a))

    return sent


@pytest.mark.asyncio
async def test_the_first_decision_sends_the_result(db, monkeypatch):
    analysis_id, _ = await decided_analysis(db)
    sent = capture_mails(monkeypatch, db)

    await tasks.send_decision_mail({"job_try": 1}, analysis_id)

    analysis = await db.get(MailAnalysis, analysis_id)
    assert [(a[0], a[2], a[3]) for a in sent] == [("max@firma.de", "phishing", False)]
    assert analysis.notified_verdict == "phishing"
    assert analysis.notified_at is not None


@pytest.mark.asyncio
async def test_a_decision_taken_back_sends_nothing(db, monkeypatch):
    analysis_id, _ = await decided_analysis(db, decided_verdict=None)
    sent = capture_mails(monkeypatch, db)

    await tasks.send_decision_mail({"job_try": 1}, analysis_id)

    assert sent == []


@pytest.mark.asyncio
async def test_the_pause_has_to_be_over(db, monkeypatch):
    analysis_id, _ = await decided_analysis(db, decided_ago=timedelta(seconds=5))
    sent = capture_mails(monkeypatch, db)

    await tasks.send_decision_mail({"job_try": 1}, analysis_id)

    # a click this fresh has its own, later job
    assert sent == []


@pytest.mark.asyncio
async def test_the_same_verdict_is_not_sent_twice(db, monkeypatch):
    analysis_id, _ = await decided_analysis(db, notified_verdict="phishing")
    sent = capture_mails(monkeypatch, db)

    await tasks.send_decision_mail({"job_try": 1}, analysis_id)

    assert sent == []


@pytest.mark.asyncio
async def test_a_changed_verdict_sends_a_correction(db, monkeypatch):
    analysis_id, _ = await decided_analysis(
        db, decided_verdict="clean", notified_verdict="phishing"
    )
    sent = capture_mails(monkeypatch, db)

    await tasks.send_decision_mail({"job_try": 1}, analysis_id)

    assert [(a[2], a[3]) for a in sent] == [("clean", True)]


@pytest.mark.asyncio
async def test_an_upload_has_nobody_to_tell(db, monkeypatch):
    analysis_id, _ = await decided_analysis(db, reported_by=None)
    sent = capture_mails(monkeypatch, db)

    await tasks.send_decision_mail({"job_try": 1}, analysis_id)

    assert sent == []


@pytest.mark.asyncio
async def test_a_deleted_analysis_is_not_reported(db, monkeypatch):
    analysis_id, _ = await decided_analysis(db)
    analysis = await db.get(MailAnalysis, analysis_id)
    analysis.deleted_at = datetime.utcnow()
    await add(db, analysis)
    sent = capture_mails(monkeypatch, db)

    await tasks.send_decision_mail({"job_try": 1}, analysis_id)

    assert sent == []


@pytest.mark.asyncio
async def test_deciding_queues_the_mail_job(db, api, monkeypatch):
    analysis_id, admin = await decided_analysis(db, decided_verdict=None)
    login_as(admin)
    queued = []

    async def enqueue(analysis_id, decided_at):
        queued.append((analysis_id, decided_at))

    monkeypatch.setattr(analyze, "enqueue_decision_mail", enqueue)

    response = await api.post(
        f"/analyses/{analysis_id}/decision", json={"verdict": "phishing"}
    )

    assert response.status_code == 200
    assert [entry[0] for entry in queued] == [analysis_id]


@pytest.mark.asyncio
async def test_deciding_an_upload_queues_nothing(db, api, monkeypatch):
    analysis_id, admin = await decided_analysis(
        db, decided_verdict=None, reported_by=None
    )
    login_as(admin)
    queued = []

    async def enqueue(analysis_id, decided_at):
        queued.append(analysis_id)

    monkeypatch.setattr(analyze, "enqueue_decision_mail", enqueue)

    await api.post(f"/analyses/{analysis_id}/decision", json={"verdict": "clean"})

    assert queued == []


@pytest.mark.asyncio
async def test_taking_a_decision_back_queues_nothing(db, api, monkeypatch):
    analysis_id, admin = await decided_analysis(db)
    login_as(admin)
    queued = []

    async def enqueue(analysis_id, decided_at):
        queued.append(analysis_id)

    monkeypatch.setattr(analyze, "enqueue_decision_mail", enqueue)

    response = await api.delete(f"/analyses/{analysis_id}/decision")

    # the job already queued reads an empty decision and stays quiet
    assert response.status_code == 204
    assert queued == []
