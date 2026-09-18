from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_analyze_rejects_empty_file():
    response = client.post(
        "/analyze",
        data={"team_id": "1", "submitted_by": "1"},
        files={"file": ("empty.eml", b"", "message/rfc822")},
    )

    assert response.status_code == 400
