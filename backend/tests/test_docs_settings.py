from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import docs_settings


def make_app(monkeypatch, **env) -> TestClient:
    for name in ("ROOT_PATH", "DOCS_ENABLED"):
        monkeypatch.delenv(name, raising=False)

    for name, value in env.items():
        monkeypatch.setenv(name, value)

    app = FastAPI(title="test", **docs_settings())

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return TestClient(app)


def test_without_a_proxy_swagger_loads_the_schema_from_the_root(monkeypatch):
    client = make_app(monkeypatch)

    assert "url: '/openapi.json'" in client.get("/docs").text
    assert client.get("/openapi.json").status_code == 200


def test_behind_nginx_swagger_loads_the_schema_under_api(monkeypatch):
    client = make_app(monkeypatch, ROOT_PATH="/api")

    # the page asks for /api/openapi.json, nginx strips /api on the way in
    assert "url: '/api/openapi.json'" in client.get("/docs").text
    assert client.get("/openapi.json").json()["servers"] == [{"url": "/api"}]


def test_a_root_path_does_not_break_the_routes(monkeypatch):
    client = make_app(monkeypatch, ROOT_PATH="/api")

    # nginx sends /health, not /api/health
    assert client.get("/health").json() == {"status": "ok"}


def test_docs_can_be_switched_off(monkeypatch):
    client = make_app(monkeypatch, ROOT_PATH="/api", DOCS_ENABLED="false")

    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    # the API itself stays
    assert client.get("/health").status_code == 200


def test_the_real_app_carries_the_settings(monkeypatch):
    monkeypatch.setenv("ROOT_PATH", "/api")

    assert docs_settings()["root_path"] == "/api"
