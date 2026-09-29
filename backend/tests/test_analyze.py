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
