import os
from typing import Any

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..constants import DEFAULT_TEAM_NAME
from ..database import get_db
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User

_bearer = HTTPBearer(auto_error=False)

# Keys rarely rotate here, fetch once per process, no TTL cache
_jwks: dict[str, Any] | None = None


def _issuer() -> str:
    url = os.getenv("KEYCLOAK_URL")

    if not url:
        raise HTTPException(status_code=503, detail="Keycloak is not configured")

    realm = os.getenv("KEYCLOAK_REALM", "phisheye")
    return f"{url.rstrip('/')}/realms/{realm}"


async def _get_jwks() -> dict[str, Any]:
    global _jwks

    if _jwks is None:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{_issuer()}/protocol/openid-connect/certs")
            response.raise_for_status()
        _jwks = response.json()

    return _jwks


async def _decode_token(token: str) -> dict[str, Any]:
    jwks = await _get_jwks()

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    key = next((k for k in jwks["keys"] if k["kid"] == header.get("kid")), None)

    if key is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=_issuer(),
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validates the bearer token, returns the matching local user.

    First sight: links an existing row with the same email, otherwise
    creates the user (`sub` becomes `keycloak_id`) and adds it to the
    default team. phisheye has no invite flow yet.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    claims = await _decode_token(credentials.credentials)

    keycloak_id = claims.get("sub")
    email = claims.get("email")
    name = claims.get("name") or claims.get("preferred_username") or email

    if not (keycloak_id and email and name):
        raise HTTPException(status_code=401, detail="Token is missing required claims")

    async with db.begin():
        result = await db.exec(select(User).where(User.keycloak_id == keycloak_id))
        user = result.first()

        if user is None:
            # The email may already have a row without a Keycloak link. Link
            # it, a second row would break the unique email. Safe only because
            # the realm has no self-registration, so emails come from admins.
            result = await db.exec(select(User).where(User.email == email))
            user = result.first()

            if user is not None and user.keycloak_id is not None:
                raise HTTPException(
                    status_code=409, detail="Email belongs to another account"
                )

            if user is not None:
                user.keycloak_id = keycloak_id
                db.add(user)
                return user

            user = User(
                keycloak_id=keycloak_id,
                email=email,
                name=name,
                password_hash="",
            )
            db.add(user)
            await db.flush()

            team_result = await db.exec(
                select(Team).where(Team.name == DEFAULT_TEAM_NAME)
            )
            team = team_result.first()

            if team is None:
                team = Team(name=DEFAULT_TEAM_NAME)
                db.add(team)
                await db.flush()

            db.add(TeamMembership(team_id=team.id, user_id=user.id, role="member"))

    return user
