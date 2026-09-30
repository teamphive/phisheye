import httpx
import pytest
import pytest_asyncio
from fastapi import Depends
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app import models  # noqa: F401  registers every table for create_all
from app.database import get_db
from app.main import app
from app.models.mail_analysis import MailAnalysis
from app.models.mail_attachment import MailAttachment
from app.models.team import Team
from app.models.team_membership import TeamMembership
from app.models.user import User
from app.services.auth import get_current_user


@pytest_asyncio.fixture
async def db():
    # SQLite in memory instead of Postgres. StaticPool keeps one connection,
    # otherwise every session would get its own empty database
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)

    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def test_db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = test_db

    async with sessions() as session:
        yield session

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def api():
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def login_as(user: User):
    """Skips the token check, test_auth.py covers that.

    Loads the user like the real get_current_user does: in the session of the
    request and inside its own transaction.
    """

    async def current_user(db: AsyncSession = Depends(get_db)) -> User:
        async with db.begin():
            return await db.get(User, user.id)

    app.dependency_overrides[get_current_user] = current_user


async def add(db: AsyncSession, *rows):
    for row in rows:
        db.add(row)
        await db.commit()

    return rows


async def two_teams(db: AsyncSession):
    """Anna is analyst in Team A, Ben in Team B, one analysis belongs to B."""
    team_a, team_b = await add(db, Team(name="Team A"), Team(name="Team B"))
    anna, ben = await add(
        db,
        User(email="anna@example.com", name="Anna", password_hash=""),
        User(email="ben@example.com", name="Ben", password_hash=""),
    )
    await add(
        db,
        TeamMembership(team_id=team_a.id, user_id=anna.id, role="analyst"),
        TeamMembership(team_id=team_b.id, user_id=ben.id, role="analyst"),
    )
    (analysis_b,) = await add(
        db,
        MailAnalysis(
            team_id=team_b.id,
            submitted_by=ben.id,
            subject="Rechnung",
            sender="x@example.com",
        ),
    )

    return team_a, team_b, anna, ben, analysis_b


@pytest.mark.asyncio
async def test_without_token_is_rejected(db, api):
    response = await api.get("/analyses")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_only_shows_active_team(db, api):
    _, _, anna, ben, analysis_b = await two_teams(db)

    login_as(ben)
    response = await api.get("/analyses")
    assert [item["id"] for item in response.json()] == [analysis_b.id]

    login_as(anna)
    response = await api.get("/analyses")
    assert response.json() == []


@pytest.mark.asyncio
async def test_analysis_of_other_team_is_not_found(db, api):
    _, _, anna, _, analysis_b = await two_teams(db)
    login_as(anna)

    response = await api.get(f"/analyses/{analysis_b.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_user_without_team_is_forbidden(db, api):
    (nobody,) = await add(
        db, User(email="nobody@example.com", name="Nobody", password_hash="")
    )
    login_as(nobody)

    response = await api.get("/analyses")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_switching_team_changes_what_the_user_sees(db, api):
    team_a, team_b, anna, _, analysis_b = await two_teams(db)
    await add(db, TeamMembership(team_id=team_b.id, user_id=anna.id, role="audit"))
    login_as(anna)

    # Without a choice the oldest membership counts
    me = await api.get("/me")
    assert me.json()["active_team_id"] == team_a.id

    response = await api.post("/me/team", json={"team_id": team_b.id})
    assert response.status_code == 204

    me = await api.get("/me")
    assert me.json()["active_team_id"] == team_b.id

    response = await api.get(f"/analyses/{analysis_b.id}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_cannot_switch_to_foreign_team(db, api):
    _, team_b, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.post("/me/team", json={"team_id": team_b.id})

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_audit_cannot_upload(db, api):
    team_a, _, anna, _, _ = await two_teams(db)
    (auditor,) = await add(
        db, User(email="audit@example.com", name="Audit", password_hash="")
    )
    await add(db, TeamMembership(team_id=team_a.id, user_id=auditor.id, role="audit"))
    login_as(auditor)

    response = await api.post(
        "/analyses", files={"file": ("mail.eml", b"Subject: hi", "message/rfc822")}
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_upload_rejects_empty_file(db, api):
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.post(
        "/analyses", files={"file": ("empty.eml", b"", "message/rfc822")}
    )

    assert response.status_code == 400


async def join(db: AsyncSession, team, role: str, name: str) -> User:
    (user,) = await add(
        db, User(email=f"{name.lower()}@example.com", name=name, password_hash="")
    )
    await add(db, TeamMembership(team_id=team.id, user_id=user.id, role=role))

    return user


@pytest.mark.asyncio
async def test_detail_has_the_documented_shape(db, api):
    _, _, _, ben, analysis_b = await two_teams(db)
    await add(
        db,
        MailAttachment(
            mail_analysis_id=analysis_b.id,
            filename="rechnung.pdf.htm",
            sha256="3b19",
            size=12698,
            vt_results={
                "Scanner A": {"category": "malicious"},
                "Scanner B": {"category": "undetected"},
            },
        ),
    )
    login_as(ben)

    detail = (await api.get(f"/analyses/{analysis_b.id}")).json()

    # pending in the database, running for the frontend
    assert detail["status"] == "running"
    assert detail["thresholds"] == {"suspicious": 40, "phishing": 75}
    assert detail["decision"] is None
    assert detail["attachments"] == [
        {
            "filename": "rechnung.pdf.htm",
            "size": 12698,
            "sha256": "3b19",
            "virus_total": "1 / 2",
            "malicious": True,
        }
    ]


@pytest.mark.asyncio
async def test_decision_can_be_made_and_taken_back(db, api):
    _, _, _, ben, analysis_b = await two_teams(db)
    login_as(ben)
    url = f"/analyses/{analysis_b.id}"

    response = await api.post(f"{url}/decision", json={"verdict": "phishing"})
    assert response.status_code == 200
    assert response.json()["by"] == "Ben"

    decision = (await api.get(url)).json()["decision"]
    assert decision["verdict"] == "phishing"

    response = await api.delete(f"{url}/decision")
    assert response.status_code == 204
    assert (await api.get(url)).json()["decision"] is None


@pytest.mark.asyncio
async def test_decision_only_accepts_phishing_or_clean(db, api):
    _, _, _, ben, analysis_b = await two_teams(db)
    login_as(ben)

    response = await api.post(
        f"/analyses/{analysis_b.id}/decision", json={"verdict": "suspicious"}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_audit_cannot_decide(db, api):
    _, team_b, _, _, analysis_b = await two_teams(db)
    login_as(await join(db, team_b, "audit", "Audit"))

    response = await api.post(
        f"/analyses/{analysis_b.id}/decision", json={"verdict": "clean"}
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_only_admin_deletes_and_deleted_analyses_disappear(db, api):
    _, team_b, _, ben, analysis_b = await two_teams(db)
    url = f"/analyses/{analysis_b.id}"

    login_as(ben)
    assert (await api.delete(url)).status_code == 403

    login_as(await join(db, team_b, "admin", "Admin"))
    assert (await api.delete(url)).status_code == 204

    assert (await api.get("/analyses")).json() == []
    assert (await api.get(url)).status_code == 404


def test_vt_results_become_plain_json():
    import json
    from collections import UserDict

    from app.services.mail_analysis import _plain

    results = UserDict({"Engine": UserDict({"category": "malicious"})})

    assert json.dumps(_plain(results)) == '{"Engine": {"category": "malicious"}}'
