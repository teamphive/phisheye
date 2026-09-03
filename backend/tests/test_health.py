from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_gibt_ok_zurueck():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
