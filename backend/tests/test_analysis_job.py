# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime, timedelta
from email.message import EmailMessage

import pytest
import vt
from arq import Retry
from test_analyze import add, api, db, login_as, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.services import mail_analysis
from app.services.object_storage import ObjectStorageError
from app.worker import tasks


def mail() -> bytes:
    message = EmailMessage()
    message["From"] = "DHL <rechnung@dhl-versand.top>"
    message["Subject"] = "Ihre Rechnung"
    message.set_content("Bitte im Anhang ansehen.")
    message.add_attachment(
        b"%PDF-1.4 test",
        maintype="application",
        subtype="pdf",
        filename="rechnung.pdf",
    )
    return message.as_bytes()


@pytest.fixture
def storage(monkeypatch):
    """MinIO and Redis stand-ins: mails are kept in a dict, jobs in a list."""
    stored: dict[str, bytes] = {}
    queued: list[int] = []

    async def store_eml(content):
        stored["key"] = content
        return "key"

    async def load_eml(key):
        return stored[key]

    async def enqueue_analysis(analysis_id):
        queued.append(analysis_id)

    monkeypatch.setattr(mail_analysis, "store_eml", store_eml)
    monkeypatch.setattr(mail_analysis, "load_eml", load_eml)
    monkeypatch.setattr(mail_analysis, "enqueue_analysis", enqueue_analysis)
    monkeypatch.delenv("VT_API_KEY", raising=False)

    return stored, queued


async def pending_analysis(db, storage, team, user) -> int:
    """An analysis as the upload leaves it: stored and waiting for the worker."""
    stored, _ = storage
    stored["key"] = mail()
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team.id,
            submitted_by=user.id,
            subject="Ihre Rechnung",
            sender="DHL <rechnung@dhl-versand.top>",
            storage_key="key",
        ),
    )
    return analysis.id


@pytest.mark.asyncio
async def test_upload_answers_at_once_and_queues_the_job(db, api, storage):
    _, queued = storage
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.post(
        "/analyses", files={"file": ("mail.eml", mail(), "message/rfc822")}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "running"
    assert response.json()["subject"] == "Ihre Rechnung"
    assert queued == [response.json()["id"]]


@pytest.mark.asyncio
async def test_job_checks_attachments_and_completes(db, api, storage):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    await mail_analysis.run_analysis(analysis_id, db)

    login_as(anna)
    detail = (await api.get(f"/analyses/{analysis_id}")).json()
    assert detail["status"] == "completed"
    assert detail["step"] is None
    assert detail["duration_seconds"] is not None
    # without VT_API_KEY the attachment is stored, but unchecked
    assert detail["attachments"][0]["filename"] == "rechnung.pdf"
    assert detail["attachments"][0]["virus_total"] == "unbekannt"


@pytest.mark.asyncio
async def test_job_stores_verdict_criteria_and_links(db, api, storage):
    stored, _ = storage
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    message = EmailMessage()
    message["From"] = "DHL <rechnung@dhl-versand.top>"
    message["Reply-To"] = "billing@mail-reply-service.top"
    message["Authentication-Results"] = "mx.firma.de; spf=fail; dkim=fail"
    message["Subject"] = "Ihre Rechnung"
    message.set_content("Bitte bezahlen")
    message.add_alternative(
        '<a href="https://dhl-zahlung.top/pay">www.dhl.de</a>', subtype="html"
    )
    stored["key"] = message.as_bytes()

    await mail_analysis.run_analysis(analysis_id, db)

    login_as(anna)
    detail = (await api.get(f"/analyses/{analysis_id}")).json()
    # 40 authentication + 30 link + 20 reply-to
    assert detail["score"] == 90
    assert detail["criteria_total"] == 90
    assert detail["verdict"] == "phishing"
    assert [criterion["weight"] for criterion in detail["criteria"]] == [40, 30, 0, 20]
    assert detail["links"] == [
        {
            "text": "www.dhl.de",
            "target": "https://dhl-zahlung.top/pay",
            "finding": "Zeigt dhl.de, führt zu dhl-zahlung.top",
            "tone": "phishing",
        }
    ]


@pytest.mark.asyncio
async def test_virus_total_error_does_not_fail_the_analysis(
    db, api, storage, monkeypatch
):
    class FailingClient:
        def __init__(self, api_key):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        async def get_object_async(self, path):
            raise vt.APIError("QuotaExceededError", "quota exceeded")

    monkeypatch.setenv("VT_API_KEY", "test")
    monkeypatch.setattr(mail_analysis.vt, "Client", FailingClient)
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    await mail_analysis.run_analysis(analysis_id, db)

    login_as(anna)
    detail = (await api.get(f"/analyses/{analysis_id}")).json()
    assert detail["status"] == "completed"
    assert detail["attachments"][0]["virus_total"] == "unbekannt"


@pytest.mark.asyncio
async def test_failed_tries_are_retried_until_the_last_one(
    db, api, storage, monkeypatch
):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    async def broken_storage(key):
        raise ObjectStorageError("Object storage operation failed")

    async def session():
        yield db

    monkeypatch.setattr(mail_analysis, "load_eml", broken_storage)
    monkeypatch.setattr(tasks, "get_session", session)
    login_as(anna)
    url = f"/analyses/{analysis_id}"

    # first try: arq is asked to try again, the analysis still counts as running
    with pytest.raises(Retry):
        await tasks.analyze_mail({"job_try": 1}, analysis_id)

    detail = (await api.get(url)).json()
    assert (detail["status"], detail["error"]) == ("running", None)

    # last try: no retry, the analysis is failed and says why
    await tasks.analyze_mail({"job_try": 3}, analysis_id)

    detail = (await api.get(url)).json()
    assert detail["status"] == "failed"
    assert detail["error"]["detail"] == "Object storage operation failed"
    assert detail["error"]["step"] == "Mail wird geladen"
    assert (detail["error"]["attempt"], detail["error"]["max_attempts"]) == (3, 3)


@pytest.mark.asyncio
async def test_deleted_analysis_is_skipped(db, storage, monkeypatch):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)
    analysis = await db.get(MailAnalysis, analysis_id)
    analysis.deleted_at = datetime.utcnow()
    await add(db, analysis)

    async def must_not_load(key):
        raise AssertionError("a deleted analysis must not be loaded")

    monkeypatch.setattr(mail_analysis, "load_eml", must_not_load)

    await mail_analysis.run_analysis(analysis_id, db)


@pytest.mark.asyncio
async def test_queue_counts_all_teams_but_lists_only_the_own(db, api):
    team_a, team_b, anna, ben, analysis_b = await two_teams(db)
    start = datetime(2026, 1, 1)

    # Team B's analysis waits first, then one of Team A, one of B is running
    analysis_b.created_at = start
    await add(
        db,
        analysis_b,
        MailAnalysis(
            team_id=team_a.id,
            submitted_by=anna.id,
            subject="Paket",
            sender="post@example.com",
            created_at=start + timedelta(minutes=1),
        ),
        MailAnalysis(
            team_id=team_b.id,
            submitted_by=ben.id,
            subject="Läuft",
            sender="z@example.com",
            status="processing",
        ),
    )
    login_as(anna)

    queue = (await api.get("/queue")).json()

    assert queue["waiting"] == 2
    assert queue["workers_busy"] == 1
    assert queue["workers_total"] == 10
    # Team B's subject stays hidden, Anna's mail is second in the shared queue
    assert queue["items"] == [
        {
            "position": 2,
            "subject": "Paket",
            "sender": "post@example.com",
            "source": "upload",
            "submitted_by": "Anna",
            "queued_at": "2026-01-01T00:01:00",
        }
    ]
