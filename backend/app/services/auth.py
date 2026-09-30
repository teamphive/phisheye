import logging
import os
from typing import Any

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.user import User
from .invitations import accept_invitations

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# Keys rarely rotate here, fetch once per process, no TTL cache
_jwks: dict[str, Any] | None = None


OPERATOR_ROLE = "operator"


def _realm_url(base_url: str | None) -> str:
    if not base_url:
        raise HTTPException(status_code=503, detail="Keycloak is not configured")

    realm = os.getenv("KEYCLOAK_REALM", "phisheye")
    # Keycloak is built with /auth as its path, see frontend/Dockerfile
    return f"{base_url.rstrip('/')}/auth/realms/{realm}"


def _issuer() -> str:
    # Keycloak puts the address the browser used into `iss`. In compose the
    # backend reaches Keycloak under another name, so both can differ.
    public_url = os.getenv("KEYCLOAK_PUBLIC_URL") or os.getenv("KEYCLOAK_URL")
    return _realm_url(public_url)


async def _get_jwks() -> dict[str, Any]:
    global _jwks

    if _jwks is None:
        realm_url = _realm_url(os.getenv("KEYCLOAK_URL"))

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{realm_url}/protocol/openid-connect/certs")
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
        logger.warning(
            "Token rejected: no key %s in the cached realm keys", header.get("kid")
        )
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=_issuer(),
            audience=os.getenv("KEYCLOAK_AUDIENCE", "phisheye-backend"),
        )
    except JWTError as exc:
        # the client only sees 401, the reason goes to the log
        logger.warning("Token rejected: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def _is_operator(claims: dict[str, Any]) -> bool:
    roles = claims.get("realm_access", {}).get("roles", [])
    return OPERATOR_ROLE in roles


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validates the bearer token, returns the matching local user.

    First sight: links an existing row with the same email, otherwise
    creates the user (`sub` becomes `keycloak_id`). Open invitations for the
    email become memberships on every request, a new account has no team
    before that.

    `is_operator` follows the `operator` realm role on every request.
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
            else:
                user = User(
                    keycloak_id=keycloak_id,
                    email=email,
                    name=name,
                    password_hash="",
                )
                db.add(user)
                await db.flush()

        # A new account starts without a team, the invitations for its email
        # are the way in
        await accept_invitations(user, db)

        # The role is granted in Keycloak, the column only mirrors it. Without
        # a change SQLAlchemy writes nothing.
        user.is_operator = _is_operator(claims)
        db.add(user)

    return user
