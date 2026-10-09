"""Readiness behind GET /health/ready: is the app usable, not only alive.

/health only says the process answers and stays free of dependencies, so a
database blip never makes a container look dead. This one looks at the
services the app needs. It reuses the checks of the monitoring page and adds
Keycloak. The public answer is one word, the names of the services stay
behind the login (GET /monitoring).
"""

import os
import time

import httpx
from sqlmodel.ext.asyncio.session import AsyncSession

from . import monitoring
from .auth import _realm_url

# Without these the app cannot work at all. Worker and Keycloak down are
# degraded: the app answers, but analyses wait or nobody can log in.
CRITICAL = ("PostgreSQL", "Redis", "MinIO")
CHECKED = (*CRITICAL, "Worker")

# probes come every few seconds, the checks should not hit the database each time
CACHE_SECONDS = 5

_cache: tuple[float, str] | None = None


async def _keycloak() -> bool:
    realm_url = _realm_url(os.getenv("KEYCLOAK_URL"))

    async with httpx.AsyncClient(timeout=1) as client:
        response = await client.get(f"{realm_url}/.well-known/openid-configuration")

    return response.status_code == 200


def overall(services: list[dict]) -> str:
    """ok, degraded or down from the single service states."""
    status = {service["name"]: service["status"] for service in services}

    if any(status.get(name) == "down" for name in CRITICAL):
        return "down"

    if any(state != "ok" for state in status.values()):
        return "degraded"

    return "ok"


async def readiness(db: AsyncSession) -> list[dict]:
    """The state of every service the app needs."""
    # external APIs are left out: asking them costs quota or money, and a key
    # that is missing is a choice, not an outage
    internal = [
        service
        for service in await monitoring.services(db, None)
        if service["name"] in CHECKED
    ]

    return [*internal, await monitoring._check("Keycloak", _keycloak)]


async def public_status(db: AsyncSession) -> str:
    """The one word for GET /health/ready, kept for a few seconds."""
    global _cache

    if _cache and time.monotonic() - _cache[0] < CACHE_SECONDS:
        return _cache[1]

    status = overall(await readiness(db))
    _cache = (time.monotonic(), status)

    return status
