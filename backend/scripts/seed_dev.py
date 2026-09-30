"""Local test data: three users with the three roles, plus the backend's
Keycloak service client. Run with `just seed`, safe to run again."""

import asyncio
import os
import sys

import httpx
import load_dotenv
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.constants import DEFAULT_TEAM_NAME
from app.models.team import Team
from app.models.team_membership import TeamMembership
from app.models.user import User

PASSWORD = "phisheye"
TEAM_NAME = "Dev-Team"
SERVICE_CLIENT = "phisheye-backend-admin"
SERVICE_ROLES = ["view-users", "query-users", "manage-users"]

# email, first name, last name, team, role in the team, operator
USERS = [
    ("admin@phisheye.example", "Dev", "Admin", TEAM_NAME, "admin", True),
    ("analyst@phisheye.example", "Dev", "Analyst", TEAM_NAME, "analyst", False),
    ("audit@phisheye.example", "Dev", "Audit", TEAM_NAME, "audit", False),
    (
        "standard@phisheye.example",
        "Standard",
        "Admin",
        DEFAULT_TEAM_NAME,
        "admin",
        True,
    ),
    (
        "auditor@phisheye.example",
        "Instanz",
        "Auditor",
        DEFAULT_TEAM_NAME,
        "audit",
        False,
    ),
]


def seed_keycloak(client: httpx.Client, admin_url: str, service_secret: str) -> None:
    def get(path, **params):
        response = client.get(f"{admin_url}{path}", params=params)
        response.raise_for_status()
        return response.json()

    def post(path, body):
        response = client.post(f"{admin_url}{path}", json=body)
        response.raise_for_status()
        return response

    # the mail theme is set in the realm template, an existing realm gets it here
    response = client.put(admin_url, json={"emailTheme": "phisheye-email"})
    response.raise_for_status()

    operator = get("/roles/operator")

    for email, first, last, _team, _role, is_operator in USERS:
        found = get("/users", email=email, exact="true")

        if found:
            user_id = found[0]["id"]
        else:
            response = post(
                "/users",
                {
                    "username": email,
                    "email": email,
                    "firstName": first,
                    "lastName": last,
                    "enabled": True,
                    "emailVerified": True,
                    "credentials": [
                        {"type": "password", "value": PASSWORD, "temporary": False}
                    ],
                },
            )
            user_id = response.headers["Location"].rsplit("/", 1)[-1]

        # Keycloak adds its default action after the create, so clear it here
        response = client.put(
            f"{admin_url}/users/{user_id}", json={"requiredActions": []}
        )
        response.raise_for_status()

        if is_operator:
            post(f"/users/{user_id}/role-mappings/realm", [operator])

    if get("/clients", clientId=SERVICE_CLIENT):
        return

    post(
        "/clients",
        {
            "clientId": SERVICE_CLIENT,
            "secret": service_secret,
            "serviceAccountsEnabled": True,
            "publicClient": False,
            "standardFlowEnabled": False,
            "directAccessGrantsEnabled": False,
        },
    )
    client_id = get("/clients", clientId=SERVICE_CLIENT)[0]["id"]
    account = get(f"/clients/{client_id}/service-account-user")
    management = get("/clients", clientId="realm-management")[0]["id"]
    roles = [get(f"/clients/{management}/roles/{name}") for name in SERVICE_ROLES]
    post(f"/users/{account['id']}/role-mappings/clients/{management}", roles)


async def seed_database(db: AsyncSession) -> None:
    async with db.begin():
        teams: dict[str, Team] = {}

        for email, first, last, team_name, role, _operator in USERS:
            team = teams.get(team_name)

            if team is None:
                result = await db.exec(select(Team).where(Team.name == team_name))
                team = result.first()

                if team is None:
                    team = Team(name=team_name)
                    db.add(team)
                    await db.flush()

                teams[team_name] = team

            result = await db.exec(select(User).where(User.email == email))
            user = result.first()

            if user is None:
                user = User(
                    email=email,
                    name=f"{first} {last}",
                    password_hash="",
                    active_team_id=team.id,
                )
                db.add(user)
                await db.flush()

            result = await db.exec(
                select(TeamMembership)
                .where(TeamMembership.team_id == team.id)
                .where(TeamMembership.user_id == user.id)
            )

            if result.first() is None:
                db.add(TeamMembership(team_id=team.id, user_id=user.id, role=role))


def main() -> None:
    load_dotenv.load_dotenv()

    # never on a server: the accounts have a known password
    if "localhost" not in os.getenv("KEYCLOAK_PUBLIC_URL", "http://localhost:8080"):
        sys.exit("Only for local development, KEYCLOAK_PUBLIC_URL is not localhost")

    secret = os.getenv("KEYCLOAK_SERVICE_CLIENT_SECRET")
    if not secret:
        sys.exit("KEYCLOAK_SERVICE_CLIENT_SECRET is missing in .env")

    base = os.getenv("KEYCLOAK_URL", "http://localhost:8080").rstrip("/") + "/auth"
    realm = os.getenv("KEYCLOAK_REALM", "phisheye")

    with httpx.Client(timeout=15) as client:
        login = client.post(
            f"{base}/realms/master/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": os.getenv("KEYCLOAK_ADMIN_USER", ""),
                "password": os.getenv("KEYCLOAK_ADMIN_PASSWORD", ""),
            },
        )
        login.raise_for_status()
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

        seed_keycloak(client, f"{base}/admin/realms/{realm}", secret)

    from app.database import SessionLocal

    async def run():
        async with SessionLocal() as db:
            await seed_database(db)

    asyncio.run(run())

    print(f"Done. Sign in with admin@phisheye.example / {PASSWORD}")


if __name__ == "__main__":
    main()
