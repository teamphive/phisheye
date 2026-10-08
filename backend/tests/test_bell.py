# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime, timedelta

import pytest
from sqlmodel import select
from test_analysis_job import pending_analysis, storage  # noqa: F401
from test_analyze import add, api, db, join, login_as, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.models.notification import Notification
from app.models.team_invitation import TeamInvitation
from app.models.user import User
from app.services import mail_analysis
from app.services.bell import delete_old
from app.services.invitations import accept_invitations


def entry(user, **fields) -> Notification:
    fields.setdefault("kind", "analysis")
    fields.setdefault("tone", "info")
    fields.setdefault("title", "Test")
    fields.setdefault("detail", "")
    fields.setdefault("target", "/")
    return Notification(user_id=user.id, **fields)


async def entries_of(db, user: User | int) -> list[Notification]:
    user_id = user if isinstance(user, int) else user.id
    result = await db.exec(select(Notification).where(Notification.user_id == user_id))
    return list(result.all())


# GET /notifications


@pytest.mark.asyncio
async def test_list_has_unread_first_then_newest(db, api):
    _, _, anna, _, _ = await two_teams(db)
    now = datetime.utcnow()
    await add(
        db,
        entry(anna, title="alt, ungelesen", created_at=now - timedelta(days=2)),
        entry(anna, title="neu, gelesen", created_at=now, read_at=now),
        entry(anna, title="neu, ungelesen", created_at=now - timedelta(hours=1)),
    )
    login_as(anna)

    response = await api.get("/notifications")

    assert response.status_code == 200
    assert [(n["title"], n["read"]) for n in response.json()] == [
        ("neu, ungelesen", False),
        ("alt, ungelesen", False),
        ("neu, gelesen", True),
    ]
    assert set(response.json()[0]) == {
        "id",
        "kind",
        "tone",
        "title",
        "detail",
        "target",
        "created_at",
        "read",
    }


@pytest.mark.asyncio
async def test_list_shows_only_ones_own_and_nothing_older_than_14_days(db, api):
    _, _, anna, ben, _ = await two_teams(db)
    await add(
        db,
        entry(anna, title="meins"),
        entry(ben, title="Bens"),
        entry(anna, title="zu alt", created_at=datetime.utcnow() - timedelta(days=15)),
    )
    login_as(anna)

    titles = [n["title"] for n in (await api.get("/notifications")).json()]

    assert titles == ["meins"]


@pytest.mark.asyncio
async def test_user_without_team_sees_the_bell(db, api):
    (guest,) = await add(db, User(email="gast@firma.de", name="Gast", password_hash=""))
    await add(db, entry(guest, title="Willkommen"))
    login_as(guest)

    response = await api.get("/notifications")

    # no team needed, an invitation entry reaches people before their first team
    assert [n["title"] for n in response.json()] == ["Willkommen"]


# POST /notifications/read


@pytest.mark.asyncio
async def test_mark_some_read(db, api):
    _, _, anna, _, _ = await two_teams(db)
    first, second = await add(db, entry(anna), entry(anna))
    login_as(anna)

    response = await api.post("/notifications/read", json={"ids": [first.id]})

    assert response.status_code == 204
    read = {n["id"]: n["read"] for n in (await api.get("/notifications")).json()}
    assert read == {first.id: True, second.id: False}


@pytest.mark.asyncio
async def test_mark_all_read_without_body(db, api):
    _, _, anna, _, _ = await two_teams(db)
    await add(db, entry(anna), entry(anna))
    login_as(anna)

    assert (await api.post("/notifications/read")).status_code == 204

    assert all(n["read"] for n in (await api.get("/notifications")).json())


@pytest.mark.asyncio
async def test_cannot_mark_someone_elses_read(db, api):
    _, _, anna, ben, _ = await two_teams(db)
    (bens,) = await add(db, entry(ben))
    login_as(anna)

    await api.post("/notifications/read", json={"ids": [bens.id]})

    login_as(ben)
    assert [n["read"] for n in (await api.get("/notifications")).json()] == [False]


# Created by the analysis


@pytest.mark.asyncio
async def test_finished_upload_rings_for_the_uploader(db, storage):
    team_a, _, anna, _, _ = await two_teams(db)
    carl = await join(db, team_a, "analyst", "Carl")
    analysis_id = await pending_analysis(db, storage, team_a, anna)
    analysis = await db.get(MailAnalysis, analysis_id)
    analysis.handled_by = anna.id
    await add(db, analysis)

    await mail_analysis.run_analysis(analysis_id, db)

    (notification,) = await entries_of(db, anna)
    assert notification.kind == "analysis"
    # the test mail passes every rule
    assert notification.tone == "clean"
    assert notification.title == "Analyse abgeschlossen: Legitim (0 %)"
    assert notification.detail == "„Ihre Rechnung“"
    assert notification.target == f"/analysen/{analysis_id}"
    # only the assigned person
    assert await entries_of(db, carl) == []


@pytest.mark.asyncio
async def test_finished_report_rings_for_admins_and_analysts_not_audit(db, storage):
    team_a, _, anna, _, _ = await two_teams(db)
    boss = await join(db, team_a, "admin", "Boss")
    ute = await join(db, team_a, "audit", "Ute")
    # nobody assigned, like an Outlook report
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    await mail_analysis.run_analysis(analysis_id, db)

    assert len(await entries_of(db, anna)) == 1
    assert len(await entries_of(db, boss)) == 1
    assert await entries_of(db, ute) == []


@pytest.mark.asyncio
async def test_failed_analysis_rings_only_after_the_last_try(db, storage):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)
    # record_failure starts with a rollback, that makes every loaded object
    # stale, anna.id afterwards would have to be loaded again
    anna_id = anna.id

    await mail_analysis.record_failure(analysis_id, RuntimeError("x"), 1, 3, db)
    assert await entries_of(db, anna_id) == []

    await mail_analysis.record_failure(analysis_id, RuntimeError("x"), 3, 3, db)

    (notification,) = await entries_of(db, anna_id)
    assert (notification.title, notification.tone) == (
        "Analyse fehlgeschlagen",
        "phishing",
    )


# Created by an accepted invitation


@pytest.mark.asyncio
async def test_accepted_invitation_tells_the_new_member_and_the_team(db):
    team_a, _, anna, _, _ = await two_teams(db)
    (guest,) = await add(db, User(email="gast@firma.de", name="Gast", password_hash=""))
    await add(
        db,
        TeamInvitation(
            team_id=team_a.id, email="gast@firma.de", role="analyst", invited_by=anna.id
        ),
    )

    async with db.begin():
        await accept_invitations(guest, db)

    (to_guest,) = await entries_of(db, guest)
    assert to_guest.title == "Anna hat dich zum Team Team A hinzugefügt"
    (to_anna,) = await entries_of(db, anna)
    assert to_anna.title == "Gast ist dem Team Team A beigetreten"
    assert to_anna.kind == "team"


# Cleanup


@pytest.mark.asyncio
async def test_cleanup_deletes_what_is_older_than_14_days(db):
    _, _, anna, _, _ = await two_teams(db)
    now = datetime.utcnow()
    await add(
        db,
        entry(anna, title="neu"),
        # read or not does not matter
        entry(anna, title="alt", created_at=now - timedelta(days=15), read_at=now),
        entry(anna, title="alt", created_at=now - timedelta(days=20)),
    )

    assert await delete_old(db) == 2

    assert [n.title for n in await entries_of(db, anna)] == ["neu"]
