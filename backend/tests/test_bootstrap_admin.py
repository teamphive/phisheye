import httpx
import pytest
import respx

from scripts import bootstrap_admin

ADMIN = "http://keycloak:8080/auth/admin/realms/phisheye"


@pytest.fixture(autouse=True)
def keycloak(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_URL", "http://keycloak:8080")
    monkeypatch.setenv("KEYCLOAK_SERVICE_CLIENT_SECRET", "secret")


@pytest.mark.asyncio
async def test_bootstrap_needs_an_address(monkeypatch):
    monkeypatch.delenv("PHISHEYE_ADMIN_EMAIL", raising=False)

    with pytest.raises(SystemExit):
        await bootstrap_admin.main()


@pytest.mark.asyncio
async def test_bootstrap_creates_the_account_and_mails_the_link(monkeypatch):
    monkeypatch.setenv("PHISHEYE_ADMIN_EMAIL", "chef@firma.de")

    with respx.mock() as router:
        router.post(
            "http://keycloak:8080/auth/realms/phisheye/protocol/openid-connect/token"
        ).mock(return_value=httpx.Response(200, json={"access_token": "t"}))
        router.get(f"{ADMIN}/users").mock(return_value=httpx.Response(200, json=[]))
        router.post(f"{ADMIN}/users").mock(
            return_value=httpx.Response(201, headers={"Location": f"{ADMIN}/users/u1"})
        )
        mail = router.put(f"{ADMIN}/users/u1/execute-actions-email").mock(
            return_value=httpx.Response(204)
        )

        await bootstrap_admin.main()

        assert mail.called


@pytest.mark.asyncio
async def test_bootstrap_leaves_an_account_with_a_password_alone(monkeypatch):
    monkeypatch.setenv("PHISHEYE_ADMIN_EMAIL", "chef@firma.de")

    with respx.mock(assert_all_called=False) as router:
        router.post(
            "http://keycloak:8080/auth/realms/phisheye/protocol/openid-connect/token"
        ).mock(return_value=httpx.Response(200, json={"access_token": "t"}))
        router.get(f"{ADMIN}/users").mock(
            return_value=httpx.Response(200, json=[{"id": "u1"}])
        )
        router.get(f"{ADMIN}/users/u1/credentials").mock(
            return_value=httpx.Response(200, json=[{"type": "password"}])
        )
        mail = router.put(f"{ADMIN}/users/u1/execute-actions-email")

        with pytest.raises(SystemExit):
            await bootstrap_admin.main()

        assert not mail.called
