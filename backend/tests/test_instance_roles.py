# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from test_analyze import add, api, db, login_as  # noqa: F401
from test_team import instance_team, team_with

from app.models.mail_analysis import MailAnalysis
from app.models.team import Team
from app.models.team_membership import TeamMembership
from app.models.user import User
from app.services import auth


async def world(db):
    """The default team with an instance admin and auditor, one customer team."""
    _, (boss, auditor) = await instance_team(db, "admin", "audit")
    team, (owner, analyst) = await team_with(db, "admin", "analyst")
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team.id, submitted_by=owner.id, subject="s", sender="x@y.de"
        ),
    )
    # ids are read now, the tests roll the session back more than once
    return boss, auditor, owner, analyst, team.id, analysis.id


@pytest.mark.asyncio
async def test_instance_members_see_every_team_in_me(db, api):
    boss, auditor, owner, _, team_id, _ = await world(db)

    login_as(boss)
    me = (await api.get("/me")).json()
    assert me["instance_role"] == "admin"
    assert me["can_create_teams"] is True
    teams = {t["name"]: t for t in me["teams"]}
    assert set(teams) == {"Standard-Team", "Team A"}
    assert teams["Team A"]["via_instance"] is True
    assert teams["Team A"]["role"] == "admin"
    assert teams["Standard-Team"]["via_instance"] is False

    login_as(auditor)
    me = (await api.get("/me")).json()
    assert me["instance_role"] == "audit"
    assert me["can_create_teams"] is False
    assert {t["name"]: t["role"] for t in me["teams"]}["Team A"] == "audit"

    login_as(owner)
    me = (await api.get("/me")).json()
    assert me["instance_role"] is None
    assert me["can_create_teams"] is False
    assert [t["name"] for t in me["teams"]] == ["Team A"]
    assert me["teams"][0]["via_instance"] is False


@pytest.mark.asyncio
async def test_a_normal_user_cannot_enter_a_foreign_team(db, api):
    _, _, owner, _, team_id, _ = await world(db)
    (other,) = await add(db, User(email="o@example.com", name="O", password_hash=""))
    (other_team,) = await add(db, Team(name="Team C"))
    await add(db, TeamMembership(team_id=other_team.id, user_id=other.id))
    login_as(other)

    assert (await api.post("/me/team", json={"team_id": team_id})).status_code == 404


@pytest.mark.asyncio
async def test_instance_admin_works_in_a_foreign_team(db, api):
    boss, _, _, _, team_id, analysis_id = await world(db)
    login_as(boss)

    assert (await api.post("/me/team", json={"team_id": team_id})).status_code == 204

    me = (await api.get("/me")).json()
    assert me["active_team_id"] == team_id
    assert [a["id"] for a in (await api.get("/analyses")).json()] == [analysis_id]
    assert (await api.get("/team")).status_code == 200
    renamed = await api.patch("/team", json={"name": "Umbenannt"})
    assert renamed.status_code == 200 and renamed.json()["role"] == "admin"
    assert (await api.delete(f"/analyses/{analysis_id}")).status_code == 204


@pytest.mark.asyncio
async def test_instance_auditor_only_reads_in_a_foreign_team(db, api):
    _, auditor, _, _, team_id, analysis_id = await world(db)
    login_as(auditor)

    assert (await api.post("/me/team", json={"team_id": team_id})).status_code == 204

    assert [a["id"] for a in (await api.get("/analyses")).json()] == [analysis_id]
    assert (await api.patch("/team", json={"name": "X"})).status_code == 403
    assert (await api.delete(f"/analyses/{analysis_id}")).status_code == 403
    decision = await api.post(
        f"/analyses/{analysis_id}/decision", json={"verdict": "clean"}
    )
    assert decision.status_code == 403


@pytest.mark.asyncio
async def test_a_deleted_team_cannot_be_entered(db, api):
    boss, _, _, _, team_id, _ = await world(db)
    team = await db.get(Team, team_id)
    team.deleted_at = datetime.utcnow()
    await add(db, team)
    login_as(boss)

    assert (await api.post("/me/team", json={"team_id": team_id})).status_code == 404


@pytest.mark.asyncio
async def test_only_the_instance_admin_creates_teams(db, api):
    boss, auditor, owner, _, _, _ = await world(db)

    for user in (owner, auditor):
        login_as(user)
        assert (await api.post("/teams", json={"name": "Neu"})).status_code == 403

    login_as(boss)
    assert (await api.post("/teams", json={"name": "Neu"})).status_code == 201


@pytest.mark.asyncio
async def test_the_default_team_is_protected(db, api):
    boss, _, _, _, _, _ = await world(db)
    login_as(boss)
    await api.post(
        "/me/team", json={"team_id": (await api.get("/me")).json()["teams"][0]["id"]}
    )

    assert (await api.patch("/team", json={"name": "Andere"})).status_code == 409
    assert (await api.delete("/team")).status_code == 409


@pytest.mark.asyncio
async def test_the_default_team_has_no_analysts(db, api):
    boss, auditor, _, _, _, _ = await world(db)
    login_as(boss)
    await api.post(
        "/me/team", json={"team_id": (await api.get("/me")).json()["teams"][0]["id"]}
    )

    invite = await api.post(
        "/team/invitations", json={"email": "neu@firma.de", "role": "analyst"}
    )
    assert invite.status_code == 422

    ok = await api.post(
        "/team/invitations", json={"email": "neu@firma.de", "role": "audit"}
    )
    assert ok.status_code == 201

    demote = await api.patch(f"/team/members/{auditor.id}", json={"role": "analyst"})
    assert demote.status_code == 422


def credentials():
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")


def claims(email, verified=True):
    async def decode(_token):
        return {"sub": "kc-1", "email": email, "name": "N", "email_verified": verified}

    return decode


@pytest.mark.asyncio
async def test_instance_admin_is_operator_without_the_keycloak_role(db, monkeypatch):
    _, (boss,) = await instance_team(db, "admin")
    boss.keycloak_id = "kc-1"
    await add(db, boss)
    monkeypatch.setattr(auth, "_decode_token", claims(boss.email))

    user = await auth.get_current_user(credentials(), db)

    assert user.is_operator is True


@pytest.mark.asyncio
async def test_the_auditor_is_no_operator(db, monkeypatch):
    _, (auditor,) = await instance_team(db, "audit")
    auditor.keycloak_id = "kc-1"
    await add(db, auditor)
    monkeypatch.setattr(auth, "_decode_token", claims(auditor.email))

    user = await auth.get_current_user(credentials(), db)

    assert user.is_operator is False


@pytest.mark.asyncio
async def test_the_address_from_the_env_becomes_instance_admin(db, monkeypatch):
    monkeypatch.setenv("PHISHEYE_ADMIN_EMAIL", "Chef@Firma.de")
    monkeypatch.setattr(auth, "_decode_token", claims("chef@firma.de"))

    user = await auth.get_current_user(credentials(), db)

    assert user.is_operator is True
    assert user.active_team_id is not None
    team = await db.get(Team, user.active_team_id)
    assert team.name == "Standard-Team"


@pytest.mark.asyncio
async def test_the_admin_address_needs_a_verified_email(db, monkeypatch):
    monkeypatch.setenv("PHISHEYE_ADMIN_EMAIL", "chef@firma.de")
    monkeypatch.setattr(auth, "_decode_token", claims("chef@firma.de", verified=False))

    user = await auth.get_current_user(credentials(), db)

    assert user.is_operator is False
    assert user.active_team_id is None


@pytest.mark.asyncio
async def test_without_the_env_nobody_becomes_instance_admin(db, monkeypatch):
    monkeypatch.delenv("PHISHEYE_ADMIN_EMAIL", raising=False)
    monkeypatch.setattr(auth, "_decode_token", claims("chef@firma.de"))

    user = await auth.get_current_user(credentials(), db)

    assert user.is_operator is False
