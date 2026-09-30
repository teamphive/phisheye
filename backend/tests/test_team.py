# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import pytest
from sqlmodel import select
from test_analyze import add, api, db, login_as  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.models.team import Team
from app.models.team_membership import TeamMembership
from app.models.user import User


async def team_with(db, *roles):
    """One team, one user per role (u0, u1, ...) in the order given."""
    (team,) = await add(db, Team(name="Team A"))
    users = await add(
        db,
        *[
            User(email=f"u{i}@example.com", name=f"User {i}", password_hash="")
            for i in range(len(roles))
        ],
    )
    await add(
        db,
        *[
            TeamMembership(team_id=team.id, user_id=user.id, role=role)
            for user, role in zip(users, roles, strict=True)
        ],
    )

    return team, users


@pytest.mark.asyncio
async def test_team_lists_members_with_counts(db, api):
    team, (admin, analyst) = await team_with(db, "admin", "analyst")
    await add(
        db,
        MailAnalysis(
            team_id=team.id, submitted_by=analyst.id, subject="s", sender="x@y.de"
        ),
    )
    login_as(admin)

    response = await api.get("/team")

    assert response.status_code == 200
    members = response.json()["members"]
    assert [m["is_self"] for m in members] == [True, False]
    assert [m["analysis_count"] for m in members] == [0, 1]
    assert response.json()["invitations"] == []


@pytest.mark.asyncio
async def test_create_team_makes_creator_admin(db, api):
    _, (user,) = await team_with(db, "analyst")
    login_as(user)

    response = await api.post("/teams", json={"name": "  Neues Team  "})

    assert response.status_code == 201
    assert response.json()["name"] == "Neues Team"
    assert response.json()["role"] == "admin"
    assert response.json()["member_count"] == 1


@pytest.mark.asyncio
async def test_create_team_rejects_empty_name(db, api):
    _, (user,) = await team_with(db, "analyst")
    login_as(user)

    response = await api.post("/teams", json={"name": "   "})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_only_admin_renames_and_deletes(db, api):
    _, (admin, analyst, audit) = await team_with(db, "admin", "analyst", "audit")

    for user in (analyst, audit):
        login_as(user)
        assert (await api.patch("/team", json={"name": "X"})).status_code == 403
        assert (await api.delete("/team")).status_code == 403

    login_as(admin)
    assert (await api.patch("/team", json={"name": "Neu"})).json()["name"] == "Neu"


@pytest.mark.asyncio
async def test_deleted_team_disappears(db, api):
    team, (admin,) = await team_with(db, "admin")
    login_as(admin)

    assert (await api.delete("/team")).status_code == 204

    me = await api.get("/me")
    assert me.json()["teams"] == []
    assert me.json()["active_team_id"] is None
    assert (await api.get("/team")).status_code == 403
    await db.refresh(team)
    assert team.deleted_at is not None


@pytest.mark.asyncio
async def test_change_role_needs_admin(db, api):
    _, (admin, analyst) = await team_with(db, "admin", "analyst")

    login_as(analyst)
    response = await api.patch(f"/team/members/{admin.id}", json={"role": "audit"})
    assert response.status_code == 403

    login_as(admin)
    response = await api.patch(f"/team/members/{analyst.id}", json={"role": "audit"})
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_last_admin_cannot_step_down(db, api):
    _, (admin, _) = await team_with(db, "admin", "analyst")
    login_as(admin)

    response = await api.patch(f"/team/members/{admin.id}", json={"role": "analyst"})

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_admin_can_step_down_with_second_admin(db, api):
    _, (first, second) = await team_with(db, "admin", "admin")
    login_as(first)

    response = await api.patch(f"/team/members/{first.id}", json={"role": "analyst"})

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_unknown_role_is_rejected(db, api):
    _, (admin, analyst) = await team_with(db, "admin", "analyst")
    login_as(admin)

    response = await api.patch(f"/team/members/{analyst.id}", json={"role": "root"})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_member_of_other_team_is_not_found(db, api):
    _, (admin,) = await team_with(db, "admin")
    (other,) = await add(db, User(email="o@example.com", name="O", password_hash=""))
    login_as(admin)

    response = await api.delete(f"/team/members/{other.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_removes_member_and_resets_their_active_team(db, api):
    team, (admin, analyst) = await team_with(db, "admin", "analyst")
    analyst.active_team_id = team.id
    await add(db, analyst)
    login_as(admin)

    response = await api.delete(f"/team/members/{analyst.id}")

    assert response.status_code == 204
    rows = await db.exec(
        select(TeamMembership).where(TeamMembership.team_id == team.id)
    )
    assert [m.user_id for m in rows.all()] == [admin.id]
    await db.refresh(analyst)
    assert analyst.active_team_id is None


@pytest.mark.asyncio
async def test_analyst_cannot_remove_others(db, api):
    _, (admin, analyst) = await team_with(db, "admin", "analyst")
    login_as(analyst)

    response = await api.delete(f"/team/members/{admin.id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_last_admin_cannot_leave(db, api):
    _, (admin, _) = await team_with(db, "admin", "analyst")
    await add(
        db,
        TeamMembership(team_id=(await add(db, Team(name="B")))[0].id, user_id=admin.id),
    )
    login_as(admin)

    response = await api.delete(f"/team/members/{admin.id}")

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_last_team_cannot_be_left(db, api):
    _, (_, analyst) = await team_with(db, "admin", "analyst")
    login_as(analyst)

    response = await api.delete(f"/team/members/{analyst.id}")

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_member_can_leave_with_second_team(db, api):
    _, (_, analyst) = await team_with(db, "admin", "analyst")
    (other,) = await add(db, Team(name="B"))
    await add(db, TeamMembership(team_id=other.id, user_id=analyst.id))
    login_as(analyst)

    response = await api.delete(f"/team/members/{analyst.id}")

    assert response.status_code == 204


async def two_factor_members(db, api, monkeypatch, otp):
    """Two members with an account, one who never signed in."""
    monkeypatch.setenv("KEYCLOAK_SERVICE_CLIENT_SECRET", "secret")
    monkeypatch.setattr("app.services.keycloak_admin.otp_users", otp)

    _, (admin, analyst, newcomer) = await team_with(db, "admin", "analyst", "analyst")
    admin.keycloak_id = "kc-admin"
    analyst.keycloak_id = "kc-analyst"
    await add(db, admin, analyst)
    login_as(admin)

    response = await api.get("/team")

    return {m["email"]: m["two_factor_enabled"] for m in response.json()["members"]}


@pytest.mark.asyncio
async def test_team_shows_two_factor_from_keycloak(db, api, monkeypatch):
    async def otp(ids):
        assert sorted(ids) == ["kc-admin", "kc-analyst"]
        return {"kc-admin": True, "kc-analyst": False}

    status = await two_factor_members(db, api, monkeypatch, otp)

    # the third member never signed in, so there is no account to ask about
    assert status == {
        "u0@example.com": True,
        "u1@example.com": False,
        "u2@example.com": False,
    }


@pytest.mark.asyncio
async def test_team_shows_unknown_when_keycloak_does_not_answer(db, api, monkeypatch):
    from app.services.keycloak_admin import KeycloakAdminError

    async def otp(ids):
        raise KeycloakAdminError("down")

    status = await two_factor_members(db, api, monkeypatch, otp)

    assert status == {
        "u0@example.com": None,
        "u1@example.com": None,
        "u2@example.com": False,
    }
