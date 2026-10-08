# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import smtplib
from datetime import datetime, timedelta

import pytest
from arq import Retry
from test_analyze import add, db  # noqa: F401
from test_team import team_with

from app.models.mail_analysis import MailAnalysis
from app.worker import tasks


async def report(db, **fields):
    fields.setdefault("reported_by", "max@firma.de")
    team, (admin,) = await team_with(db, "admin")
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team.id,
            submitted_by=admin.id,
            subject="Rechnung",
            sender="x@example.com",
            **fields,
        ),
    )

    return analysis.id, team.id, admin.id


def capture(monkeypatch, db):
    async def session():
        yield db

    sent = []
    monkeypatch.setattr(tasks, "get_session", session)
    monkeypatch.setattr(tasks, "send_receipt_mail_to", lambda *a: sent.append(a))

    return sent


@pytest.mark.asyncio
async def test_the_receipt_goes_out_once(db, monkeypatch):
    analysis_id, *_ = await report(db)
    sent = capture(monkeypatch, db)

    await tasks.send_receipt_mail({"job_try": 1}, analysis_id)
    await tasks.send_receipt_mail({"job_try": 1}, analysis_id)

    analysis = await db.get(MailAnalysis, analysis_id)
    assert [a[0] for a in sent] == ["max@firma.de"]
    assert analysis.received_at is not None
    # the receipt says nothing about a verdict, so it does not use up that mail
    assert analysis.notified_at is None
    assert analysis.notified_verdict is None


@pytest.mark.asyncio
async def test_no_receipt_after_the_verdict(db, monkeypatch):
    analysis_id, *_ = await report(db, notified_verdict="phishing")
    sent = capture(monkeypatch, db)

    await tasks.send_receipt_mail({"job_try": 1}, analysis_id)

    assert sent == []


@pytest.mark.asyncio
async def test_no_receipt_for_a_deleted_analysis(db, monkeypatch):
    analysis_id, *_ = await report(db, deleted_at=datetime.utcnow())
    sent = capture(monkeypatch, db)

    await tasks.send_receipt_mail({"job_try": 1}, analysis_id)

    assert sent == []


@pytest.mark.asyncio
async def test_no_receipt_for_an_upload(db, monkeypatch):
    analysis_id, *_ = await report(db, reported_by=None)
    sent = capture(monkeypatch, db)

    await tasks.send_receipt_mail({"job_try": 1}, analysis_id)

    assert sent == []


@pytest.mark.asyncio
async def test_a_failed_send_is_tried_again_and_leaves_no_trace(db, monkeypatch):
    analysis_id, *_ = await report(db)
    capture(monkeypatch, db)

    def broken(*args):
        raise smtplib.SMTPException("down")

    monkeypatch.setattr(tasks, "send_receipt_mail_to", broken)

    with pytest.raises(Retry):
        await tasks.send_receipt_mail({"job_try": 1}, analysis_id)

    analysis = await db.get(MailAnalysis, analysis_id)
    assert analysis.received_at is None


@pytest.mark.asyncio
async def test_receipts_and_verdict_mails_count_against_the_hourly_limit(
    db, monkeypatch
):
    analysis_id, team_id, admin_id = await report(db)
    sent = capture(monkeypatch, db)
    recently = datetime.utcnow() - timedelta(minutes=5)

    # ten mails to the same address already went out this hour, in both kinds
    for i in range(tasks.MAX_MAILS_PER_HOUR):
        await add(
            db,
            MailAnalysis(
                team_id=team_id,
                submitted_by=admin_id,
                subject=f"alt {i}",
                sender="x@example.com",
                reported_by="max@firma.de",
                received_at=recently if i % 2 else None,
                notified_at=None if i % 2 else recently,
            ),
        )

    await tasks.send_receipt_mail({"job_try": 1}, analysis_id)

    assert sent == []
