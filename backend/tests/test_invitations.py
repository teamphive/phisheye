# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import pytest
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import select
from test_analyze import add, api, db, login_as  # noqa: F401
from test_team import team_with

from app.models.team import Team
from app.models.team_invitation import TeamInvitation
from app.models.team_membership import TeamMembership
from app.models.user import User
from app.services import auth
from app.services.invitations import accept_invitations
from app.services.notifications import render_invitation


@pytest.fixture(autouse=True)
def queued(monkeypatch):
    """Redis is not running in the tests, the mail job is only recorded."""
    ids = []

    async def enqueue(invitation_id):
        ids.append(invitation_id)

    monkeypatch.setattr("app.routes.team.enqueue_team_invitation", enqueue)
    return ids


@pytest.mark.asyncio
async def test_admin_invites_and_the_mail_is_queued(db, api, queued):
    _, (admin,) = await team_with(db, "admin")
    login_as(admin)

    response = await api.post(
        "/team/invitations", json={"email": "  Neu@Firma.DE ", "role": "audit"}
    )

    assert response.status_code == 201
    assert response.json()["email"] == "neu@firma.de"
    assert response.json()["role"] == "audit"
    assert queued == [response.json()["id"]]

    invitations = (await api.get("/team")).json()["invitations"]
    assert [i["email"] for i in invitations] == ["neu@firma.de"]


@pytest.mark.asyncio
async def test_only_admin_invites(db, api, queued):
    _, (_, analyst) = await team_with(db, "admin", "analyst")
    login_as(analyst)

    response = await api.post(
        "/team/invitations", json={"email": "neu@firma.de", "role": "analyst"}
    )

    assert response.status_code == 403
    assert queued == []


@pytest.mark.asyncio
async def test_invite_rejects_bad_address_and_role(db, api):
    _, (admin,) = await team_with(db, "admin")
    login_as(admin)

    for body in (
        {"email": "kein-at", "role": "analyst"},
        {"email": "a@b", "role": "analyst"},
        {"email": "neu@firma.de", "role": "root"},
    ):
        assert (await api.post("/team/invitations", json=body)).status_code == 422


@pytest.mark.asyncio
async def test_invite_twice_or_member_is_a_conflict(db, api):
    _, (admin, analyst) = await team_with(db, "admin", "analyst")
    login_as(admin)
    body = {"email": "neu@firma.de", "role": "analyst"}

    assert (await api.post("/team/invitations", json=body)).status_code == 201
    assert (await api.post("/team/invitations", json=body)).status_code == 409

    member = {"email": analyst.email.upper(), "role": "analyst"}
    assert (await api.post("/team/invitations", json=member)).status_code == 409


@pytest.mark.asyncio
async def test_change_role_and_revoke(db, api):
    _, (admin,) = await team_with(db, "admin")
    login_as(admin)
    created = await api.post(
        "/team/invitations", json={"email": "neu@firma.de", "role": "analyst"}
    )
    invitation_id = created.json()["id"]

    changed = await api.patch(
        f"/team/invitations/{invitation_id}", json={"role": "audit"}
    )
    assert changed.status_code == 204
    invitation = await db.get(TeamInvitation, invitation_id)
    await db.refresh(invitation)
    assert invitation.role == "audit"

    assert (await api.delete(f"/team/invitations/{invitation_id}")).status_code == 204
    assert (await api.get("/team")).json()["invitations"] == []


@pytest.mark.asyncio
async def test_invitation_of_other_team_is_not_found(db, api):
    _, (admin,) = await team_with(db, "admin")
    (other_team,) = await add(db, Team(name="B"))
    (other,) = await add(
        db,
        TeamInvitation(
            team_id=other_team.id,
            email="x@firma.de",
            role="analyst",
            invited_by=admin.id,
        ),
    )
    login_as(admin)

    assert (await api.delete(f"/team/invitations/{other.id}")).status_code == 404
    response = await api.patch(f"/team/invitations/{other.id}", json={"role": "audit"})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_invitation_becomes_membership(db):
    team, (admin,) = await team_with(db, "admin")
    (guest,) = await add(db, User(email="Gast@Firma.de", name="Gast", password_hash=""))
    await add(
        db,
        TeamInvitation(
            team_id=team.id, email="gast@firma.de", role="audit", invited_by=admin.id
        ),
    )

    async with db.begin():
        await accept_invitations(guest, db)

    rows = await db.exec(
        select(TeamMembership).where(TeamMembership.user_id == guest.id)
    )
    assert [(m.team_id, m.role) for m in rows.all()] == [(team.id, "audit")]
    assert guest.active_team_id == team.id
    assert (await db.exec(select(TeamInvitation))).all() == []


@pytest.mark.asyncio
async def test_invitation_to_deleted_team_is_dropped_without_membership(db):
    from datetime import datetime

    team, (admin,) = await team_with(db, "admin")
    team.deleted_at = datetime.utcnow()
    await add(db, team)
    (guest,) = await add(db, User(email="gast@firma.de", name="Gast", password_hash=""))
    await add(
        db,
        TeamInvitation(
            team_id=team.id, email="gast@firma.de", role="analyst", invited_by=admin.id
        ),
    )

    async with db.begin():
        await accept_invitations(guest, db)

    rows = await db.exec(
        select(TeamMembership).where(TeamMembership.user_id == guest.id)
    )
    assert rows.all() == []
    assert guest.active_team_id is None


@pytest.mark.asyncio
async def test_first_login_creates_user_without_team_then_joins_by_invitation(
    db, monkeypatch
):
    team, (admin,) = await team_with(db, "admin")
    await add(
        db,
        TeamInvitation(
            team_id=team.id, email="neu@firma.de", role="analyst", invited_by=admin.id
        ),
    )

    async def claims(_token):
        return {
            "sub": "kc-new",
            "email": "neu@firma.de",
            "name": "Neu",
            "email_verified": True,
        }

    monkeypatch.setattr(auth, "_decode_token", claims)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")

    user = await auth.get_current_user(credentials, db)

    rows = await db.exec(
        select(TeamMembership).where(TeamMembership.user_id == user.id)
    )
    assert [m.team_id for m in rows.all()] == [team.id]


@pytest.mark.asyncio
async def test_first_login_without_invitation_has_no_team(db, monkeypatch):
    async def claims(_token):
        return {"sub": "kc-new", "email": "neu@firma.de", "name": "Neu"}

    monkeypatch.setattr(auth, "_decode_token", claims)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")

    user = await auth.get_current_user(credentials, db)

    rows = await db.exec(
        select(TeamMembership).where(TeamMembership.user_id == user.id)
    )
    assert rows.all() == []


def test_invitation_mail_escapes_names():
    subject, text, html = render_invitation(
        "<b>Team</b>", "Anna", "analyst", "https://phisheye.example"
    )

    assert "<b>Team</b>" not in html
    assert "&lt;b&gt;" in html
    assert "https://phisheye.example" in text
    assert "Team" in subject


def test_invitation_mail_announces_the_setup_mail_for_new_accounts():
    _, text, html = render_invitation(
        "Team", "Anna", "analyst", "https://phisheye.example", setup_follows=True
    )

    assert "zweite Mail" in text
    assert "zweite Mail" in html
    assert "https://phisheye.example" not in html


@pytest.mark.asyncio
async def test_unverified_email_does_not_join_by_invitation(db, monkeypatch):
    team, (admin,) = await team_with(db, "admin")
    await add(
        db,
        TeamInvitation(
            team_id=team.id, email="neu@firma.de", role="analyst", invited_by=admin.id
        ),
    )

    async def claims(_token):
        return {
            "sub": "kc-new",
            "email": "neu@firma.de",
            "name": "Neu",
            "email_verified": False,
        }

    monkeypatch.setattr(auth, "_decode_token", claims)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")

    user = await auth.get_current_user(credentials, db)

    rows = await db.exec(
        select(TeamMembership).where(TeamMembership.user_id == user.id)
    )
    assert rows.all() == []
    assert len((await db.exec(select(TeamInvitation))).all()) == 1
