import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient
from jose import jwk, jwt

from app.main import app
from app.services import auth

# Stands in for the realm key, Keycloak does not run in the tests
_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_private_pem = _private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
)
_public_pem = _private_key.public_key().public_bytes(
    serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo,
)


@pytest.fixture(autouse=True)
def keycloak(monkeypatch):
    # Like in compose: the backend and the browser use different addresses
    monkeypatch.setenv("KEYCLOAK_URL", "http://keycloak:8080")
    monkeypatch.setenv("KEYCLOAK_PUBLIC_URL", "http://localhost:8080")
    monkeypatch.delenv("KEYCLOAK_AUDIENCE", raising=False)

    public_key = jwk.construct(_public_pem, "RS256").to_dict()
    monkeypatch.setattr(auth, "_jwks", {"keys": [{**public_key, "kid": "test"}]})


def _token(**claims) -> str:
    payload = {
        "sub": "keycloak-user-1",
        "iss": "http://localhost:8080/auth/realms/phisheye",
        "aud": ["phisheye-backend", "account"],
        "exp": int(time.time()) + 60,
        **claims,
    }
    return jwt.encode(payload, _private_pem, algorithm="RS256", headers={"kid": "test"})


@pytest.mark.asyncio
async def test_accepts_token_with_public_issuer_and_audience():
    claims = await auth._decode_token(_token())

    assert claims["sub"] == "keycloak-user-1"


@pytest.mark.asyncio
async def test_rejects_token_without_backend_audience():
    with pytest.raises(HTTPException) as error:
        await auth._decode_token(_token(aud="account"))

    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_rejects_token_with_internal_issuer():
    with pytest.raises(HTTPException) as error:
        await auth._decode_token(
            _token(iss="http://keycloak:8080/auth/realms/phisheye")
        )

    assert error.value.status_code == 401


def test_operator_follows_realm_role():
    assert auth._is_operator({"realm_access": {"roles": ["operator"]}})
    assert not auth._is_operator({"realm_access": {"roles": ["offline_access"]}})
    assert not auth._is_operator({})


def test_cors_allows_vite_dev_server():
    client = TestClient(app)

    response = client.options(
        "/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
