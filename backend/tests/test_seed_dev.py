# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import httpx
import pytest
import respx
from sqlmodel import select
from test_analyze import db  # noqa: F401

from app.models.team import Team
from app.models.team_membership import TeamMembership
from app.models.user import User
from scripts import seed_dev

ADMIN = "http://keycloak:8080/auth/admin/realms/phisheye"


def test_refuses_to_run_outside_localhost(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_PUBLIC_URL", "https://phisheye.example")
    monkeypatch.setenv("KEYCLOAK_SERVICE_CLIENT_SECRET", "secret")

    with pytest.raises(SystemExit):
        seed_dev.main()


@pytest.mark.asyncio
async def test_database_seed_creates_both_teams_once(db):
    await seed_dev.seed_database(db)
    await seed_dev.seed_database(db)

    teams = {t.name: t.id for t in (await db.exec(select(Team))).all()}
    memberships = (await db.exec(select(TeamMembership))).all()
    users = (await db.exec(select(User))).all()

    assert sorted(teams) == ["Dev-Team", "Standard-Team"]
    assert len(users) == 5
    assert sorted((m.team_id, m.role) for m in memberships) == sorted(
        [
            (teams["Dev-Team"], "admin"),
            (teams["Dev-Team"], "analyst"),
            (teams["Dev-Team"], "audit"),
            (teams["Standard-Team"], "admin"),
            (teams["Standard-Team"], "audit"),
        ]
    )


def keycloak(users, clients):
    """Fake admin API: `users` and `clients` are what the realm answers with."""
    router = respx.mock(assert_all_called=False)
    router.put(ADMIN).mock(return_value=httpx.Response(204))
    router.get(f"{ADMIN}/roles/operator").mock(
        return_value=httpx.Response(200, json={"name": "operator"})
    )
    router.get(f"{ADMIN}/users").mock(return_value=httpx.Response(200, json=users))
    router.put(url__regex=rf"{ADMIN}/users/.+").mock(return_value=httpx.Response(204))
    router.post(url__regex=rf"{ADMIN}/users/.+/role-mappings/.+").mock(
        return_value=httpx.Response(204)
    )
    router.get(f"{ADMIN}/clients", params={"clientId": "phisheye-backend-admin"}).mock(
        return_value=httpx.Response(200, json=clients)
    )
    return router


def test_existing_users_and_client_are_left_alone():
    with keycloak([{"id": "u1"}], [{"id": "c1"}]) as router:
        create = router.post(f"{ADMIN}/users")
        client = router.post(f"{ADMIN}/clients")

        seed_dev.seed_keycloak(httpx.Client(), ADMIN, "secret")

        assert not create.called
        assert not client.called


def test_missing_users_and_client_are_created():
    with keycloak([], []) as router:
        router.post(f"{ADMIN}/users").mock(
            return_value=httpx.Response(201, headers={"Location": f"{ADMIN}/users/u1"})
        )
        client = router.post(f"{ADMIN}/clients").mock(return_value=httpx.Response(201))
        router.get(
            f"{ADMIN}/clients", params={"clientId": "phisheye-backend-admin"}
        ).mock(
            side_effect=[
                httpx.Response(200, json=[]),
                httpx.Response(200, json=[{"id": "c1"}]),
            ]
        )
        router.get(f"{ADMIN}/clients/c1/service-account-user").mock(
            return_value=httpx.Response(200, json={"id": "sa"})
        )
        router.get(f"{ADMIN}/clients", params={"clientId": "realm-management"}).mock(
            return_value=httpx.Response(200, json=[{"id": "rm"}])
        )
        router.get(url__regex=rf"{ADMIN}/clients/rm/roles/.+").mock(
            return_value=httpx.Response(200, json={"name": "role"})
        )

        seed_dev.seed_keycloak(httpx.Client(), ADMIN, "secret")

        assert b'"secret"' in client.calls.last.request.content
