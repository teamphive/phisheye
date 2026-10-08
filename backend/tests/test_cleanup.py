# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime, timedelta

import pytest
from sqlmodel import select
from test_analyze import add, db, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.models.mail_attachment import MailAttachment
from app.models.mail_link import MailLink
from app.models.notification import Notification
from app.models.team import Team
from app.services import cleanup
from app.services.object_storage import ObjectStorageError


@pytest.fixture
def minio(monkeypatch):
    deleted: list[str] = []
    broken: set[str] = set()

    async def delete_object(key):
        if key in broken:
            raise ObjectStorageError("Object storage operation failed")
        deleted.append(key)

    monkeypatch.setattr(cleanup, "delete_object", delete_object)
    return deleted, broken


async def analysis_with_everything(db, team, user, key, deleted_days_ago):
    deleted_at = (
        None
        if deleted_days_ago is None
        else datetime.utcnow() - timedelta(days=deleted_days_ago)
    )
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team.id,
            submitted_by=user.id,
            subject="T",
            sender="a@b.de",
            storage_key=key,
            deleted_at=deleted_at,
        ),
    )
    await add(
        db,
        MailAttachment(mail_analysis_id=analysis.id, filename="a.pdf", sha256="0" * 64),
        MailLink(
            mail_analysis_id=analysis.id,
            text="x",
            target="https://x.de",
            host="x.de",
            finding="Unauffällig",
            tone="clean",
        ),
        Notification(
            user_id=user.id,
            kind="analysis",
            tone="clean",
            title="Analyse abgeschlossen",
            detail="",
            target=f"/analysen/{analysis.id}",
        ),
    )
    return analysis.id


async def count(db, model, **where) -> int:
    query = select(model)
    for field, value in where.items():
        query = query.where(getattr(model, field) == value)
    return len((await db.exec(query)).all())


@pytest.mark.asyncio
async def test_old_deleted_analyses_go_with_everything(db, minio):
    deleted, _ = minio
    team_a, _, anna, _, _ = await two_teams(db)
    old = await analysis_with_everything(db, team_a, anna, "old-key", 11)
    recent = await analysis_with_everything(db, team_a, anna, "recent-key", 9)
    alive = await analysis_with_everything(db, team_a, anna, "alive-key", None)

    assert await cleanup.purge_deleted_analyses(db) == 1

    assert deleted == ["old-key"]
    assert await db.get(MailAnalysis, old) is None
    assert await count(db, MailAttachment, mail_analysis_id=old) == 0
    assert await count(db, MailLink, mail_analysis_id=old) == 0
    assert await count(db, Notification, target=f"/analysen/{old}") == 0
    # 9 days deleted can still come back, not deleted is untouched
    for kept in (recent, alive):
        assert await db.get(MailAnalysis, kept) is not None
        assert await count(db, MailAttachment, mail_analysis_id=kept) == 1


@pytest.mark.asyncio
async def test_when_minio_fails_the_analysis_stays_for_the_next_night(db, minio):
    deleted, broken = minio
    team_a, _, anna, _, _ = await two_teams(db)
    stuck = await analysis_with_everything(db, team_a, anna, "broken-key", 20)
    fine = await analysis_with_everything(db, team_a, anna, "fine-key", 20)
    broken.add("broken-key")

    # one broken file does not stop the others
    assert await cleanup.purge_deleted_analyses(db) == 1

    assert await db.get(MailAnalysis, stuck) is not None
    assert await count(db, MailAttachment, mail_analysis_id=stuck) == 1
    assert await db.get(MailAnalysis, fine) is None

    # the next night: a fresh session in the worker, here the reads above
    # have to end their transaction first
    await db.commit()
    broken.clear()
    assert await cleanup.purge_deleted_analyses(db) == 1
    assert await db.get(MailAnalysis, stuck) is None


@pytest.mark.asyncio
async def test_analysis_without_file_is_purged_too(db, minio):
    deleted, _ = minio
    team_a, _, anna, _, _ = await two_teams(db)
    gone = await analysis_with_everything(db, team_a, anna, None, 30)

    assert await cleanup.purge_deleted_analyses(db) == 1
    assert deleted == []
    assert await db.get(MailAnalysis, gone) is None


@pytest.mark.asyncio
async def test_deleted_teams_are_never_purged(db, minio):
    team_a, _, anna, _, _ = await two_teams(db)
    team_a.deleted_at = datetime.utcnow() - timedelta(days=100)
    await add(db, team_a)
    team_id = team_a.id

    await cleanup.purge_deleted_analyses(db)

    assert await db.get(Team, team_id) is not None
