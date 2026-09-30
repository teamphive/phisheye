import asyncio
import os

import httpx

# seven days to set the password
SETUP_LINK_LIFESPAN = 7 * 24 * 60 * 60


class KeycloakAdminError(Exception):
    pass


def is_configured() -> bool:
    return bool(os.getenv("KEYCLOAK_SERVICE_CLIENT_SECRET"))


def _realm_url() -> str:
    base = os.getenv("KEYCLOAK_URL", "http://localhost:8080").rstrip("/")
    return f"{base}/auth/realms/{os.getenv('KEYCLOAK_REALM', 'phisheye')}"


def _admin_url() -> str:
    return _realm_url().replace("/realms/", "/admin/realms/")


async def _login(client: httpx.AsyncClient) -> str:
    login = await client.post(
        f"{_realm_url()}/protocol/openid-connect/token",
        data={
            "grant_type": "client_credentials",
            "client_id": os.getenv(
                "KEYCLOAK_SERVICE_CLIENT_ID", "phisheye-backend-admin"
            ),
            "client_secret": os.getenv("KEYCLOAK_SERVICE_CLIENT_SECRET", ""),
        },
    )

    if login.status_code != 200:
        raise KeycloakAdminError(f"Service account login: {login.status_code}")

    return login.json()["access_token"]


async def _request(method: str, path: str, **kwargs) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15) as client:
        token = await _login(client)
        response = await client.request(
            method,
            f"{_admin_url()}{path}",
            headers={"Authorization": f"Bearer {token}"},
            **kwargs,
        )

    if response.status_code >= 400:
        raise KeycloakAdminError(f"{method} {path}: {response.status_code}")

    return response


async def find_user(email: str) -> dict | None:
    response = await _request("GET", "/users", params={"email": email, "exact": "true"})
    users = response.json()

    return users[0] if users else None


# no password, the person sets it with the mailed link
async def create_user(email: str) -> str:
    response = await _request(
        "POST", "/users", json={"username": email, "email": email, "enabled": True}
    )

    return response.headers["Location"].rsplit("/", 1)[-1]


async def has_password(user_id: str) -> bool:
    response = await _request("GET", f"/users/{user_id}/credentials")

    return any(c.get("type") == "password" for c in response.json())


# Keycloak sends the mail itself
async def send_setup_email(user_id: str) -> None:
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    await _request(
        "PUT",
        f"/users/{user_id}/execute-actions-email",
        params={
            "client_id": "phisheye-frontend",
            "redirect_uri": f"{frontend}/",
            "lifespan": SETUP_LINK_LIFESPAN,
        },
        json=["UPDATE_PASSWORD", "UPDATE_PROFILE"],
    )


# who has set up two factor: one login, one request per user, in parallel
async def otp_users(user_ids: list[str]) -> dict[str, bool]:
    async with httpx.AsyncClient(timeout=15) as client:
        headers = {"Authorization": f"Bearer {await _login(client)}"}

        async def has_otp(user_id: str) -> tuple[str, bool]:
            response = await client.get(
                f"{_admin_url()}/users/{user_id}/credentials", headers=headers
            )

            # the account is gone in Keycloak
            if response.status_code == 404:
                return user_id, False

            if response.status_code >= 400:
                raise KeycloakAdminError(f"credentials: {response.status_code}")

            return user_id, any(c.get("type") == "otp" for c in response.json())

        return dict(await asyncio.gather(*(has_otp(user_id) for user_id in user_ids)))
