import httpx
import pytest
import respx

from app.services import invitations, keycloak_admin

BASE = "http://keycloak:8080/auth"
ADMIN = f"{BASE}/admin/realms/phisheye"


@pytest.fixture(autouse=True)
def keycloak(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_URL", "http://keycloak:8080")
    monkeypatch.setenv("KEYCLOAK_REALM", "phisheye")
    monkeypatch.setenv("KEYCLOAK_SERVICE_CLIENT_SECRET", "secret")
    monkeypatch.setenv("FRONTEND_URL", "https://phisheye.example")


@pytest.fixture
def mocked():
    with respx.mock(assert_all_called=False) as router:
        router.post(f"{BASE}/realms/phisheye/protocol/openid-connect/token").mock(
            return_value=httpx.Response(
                200, json={"access_token": "t", "expires_in": 300}
            )
        )
        yield router


@pytest.fixture
def sent(monkeypatch):
    """Records the mails of the app, SMTP is not available in the tests."""
    mails = []
    monkeypatch.setattr(
        invitations, "send_invitation_mail", lambda *args: mails.append(args)
    )
    return mails


@pytest.mark.asyncio
async def test_new_person_gets_account_and_setup_mail_from_keycloak(mocked, sent):
    mocked.get(f"{ADMIN}/users").mock(return_value=httpx.Response(200, json=[]))
    create = mocked.post(f"{ADMIN}/users").mock(
        return_value=httpx.Response(201, headers={"Location": f"{ADMIN}/users/abc-1"})
    )
    setup = mocked.put(f"{ADMIN}/users/abc-1/execute-actions-email").mock(
        return_value=httpx.Response(204)
    )

    await invitations.deliver_invitation("neu@firma.de", "Team A", "Anna", "analyst")

    assert b'"neu@firma.de"' in create.calls.last.request.content
    request = setup.calls.last.request
    assert request.url.params["client_id"] == "phisheye-frontend"
    assert request.url.params["redirect_uri"] == "https://phisheye.example/"
    assert b"UPDATE_PASSWORD" in request.content
    assert sent == [("neu@firma.de", "Team A", "Anna", "analyst", True)]


@pytest.mark.asyncio
async def test_account_without_password_gets_the_setup_mail_again(mocked, sent):
    mocked.get(f"{ADMIN}/users").mock(
        return_value=httpx.Response(200, json=[{"id": "abc-1"}])
    )
    mocked.get(f"{ADMIN}/users/abc-1/credentials").mock(
        return_value=httpx.Response(200, json=[])
    )
    setup = mocked.put(f"{ADMIN}/users/abc-1/execute-actions-email").mock(
        return_value=httpx.Response(204)
    )

    await invitations.deliver_invitation("neu@firma.de", "Team A", "Anna", "analyst")

    assert setup.called
    assert sent == [("neu@firma.de", "Team A", "Anna", "analyst", True)]


@pytest.mark.asyncio
async def test_existing_account_gets_the_invitation_mail(mocked, sent):
    mocked.get(f"{ADMIN}/users").mock(
        return_value=httpx.Response(200, json=[{"id": "abc-1"}])
    )
    mocked.get(f"{ADMIN}/users/abc-1/credentials").mock(
        return_value=httpx.Response(200, json=[{"type": "password"}])
    )
    setup = mocked.put(f"{ADMIN}/users/abc-1/execute-actions-email")

    await invitations.deliver_invitation("neu@firma.de", "Team A", "Anna", "analyst")

    assert not setup.called
    assert sent == [("neu@firma.de", "Team A", "Anna", "analyst", False)]


@pytest.mark.asyncio
async def test_without_service_account_only_the_invitation_mail_goes_out(
    monkeypatch, sent
):
    monkeypatch.delenv("KEYCLOAK_SERVICE_CLIENT_SECRET")

    await invitations.deliver_invitation("neu@firma.de", "Team A", "Anna", "analyst")

    assert sent == [("neu@firma.de", "Team A", "Anna", "analyst", False)]


@pytest.mark.asyncio
async def test_keycloak_error_is_raised_for_the_retry(mocked, sent):
    mocked.get(f"{ADMIN}/users").mock(return_value=httpx.Response(500))

    with pytest.raises(keycloak_admin.KeycloakAdminError):
        await invitations.deliver_invitation(
            "neu@firma.de", "Team A", "Anna", "analyst"
        )

    assert sent == []


@pytest.mark.asyncio
async def test_rejected_service_login_is_an_error(mocked):
    mocked.post(f"{BASE}/realms/phisheye/protocol/openid-connect/token").mock(
        return_value=httpx.Response(401)
    )

    with pytest.raises(keycloak_admin.KeycloakAdminError):
        await keycloak_admin.find_user("neu@firma.de")


@pytest.mark.asyncio
async def test_otp_users_tells_who_has_two_factor(mocked):
    mocked.get(f"{ADMIN}/users/a/credentials").mock(
        return_value=httpx.Response(200, json=[{"type": "password"}, {"type": "otp"}])
    )
    mocked.get(f"{ADMIN}/users/b/credentials").mock(
        return_value=httpx.Response(200, json=[{"type": "password"}])
    )
    mocked.get(f"{ADMIN}/users/c/credentials").mock(return_value=httpx.Response(404))

    assert await keycloak_admin.otp_users(["a", "b", "c"]) == {
        "a": True,
        "b": False,
        "c": False,
    }


@pytest.mark.asyncio
async def test_otp_users_fails_when_keycloak_does(mocked):
    mocked.get(f"{ADMIN}/users/a/credentials").mock(return_value=httpx.Response(500))

    with pytest.raises(keycloak_admin.KeycloakAdminError):
        await keycloak_admin.otp_users(["a"])
