# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import pytest
from test_analyze import add, api, db, join, login_as, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.routes import analyze
from app.services.object_storage import ObjectStorageError

EML = b"From: a@b.de\r\nSubject: Test\r\n\r\nHallo"


@pytest.fixture
def minio(monkeypatch):
    stored = {"key-1": EML}

    async def load_eml(key):
        if key not in stored:
            raise ObjectStorageError("Object storage operation failed")
        return stored[key]

    monkeypatch.setattr(analyze, "load_eml", load_eml)
    return stored


async def analysis_of(db, team, user, **fields):
    fields.setdefault("storage_key", "key-1")
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team.id,
            submitted_by=user.id,
            subject="T",
            sender="a@b.de",
            **fields,
        ),
    )
    return analysis


@pytest.mark.asyncio
async def test_download_is_a_file_not_a_page(db, api, minio):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis = await analysis_of(db, team_a, anna)
    login_as(anna)

    response = await api.get(f"/analyses/{analysis.id}/eml")

    assert response.status_code == 200
    assert response.content == EML
    # saved, never shown or run by the browser
    assert response.headers["content-type"] == "application/octet-stream"
    assert response.headers["content-disposition"] == (
        f'attachment; filename="phisheye-{analysis.id}.eml"'
    )
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.asyncio
async def test_audit_may_download(db, api, minio):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis = await analysis_of(db, team_a, anna)
    login_as(await join(db, team_a, "audit", "Ute"))

    assert (await api.get(f"/analyses/{analysis.id}/eml")).status_code == 200


@pytest.mark.asyncio
async def test_other_team_deleted_or_without_file_is_not_found(db, api, minio):
    from datetime import datetime

    team_a, _, anna, _, analysis_b = await two_teams(db)
    deleted = await analysis_of(db, team_a, anna, deleted_at=datetime.utcnow())
    without_file = await analysis_of(db, team_a, anna, storage_key=None)
    login_as(anna)

    for analysis in (analysis_b, deleted, without_file):
        assert (await api.get(f"/analyses/{analysis.id}/eml")).status_code == 404


@pytest.mark.asyncio
async def test_minio_down_is_503(db, api, minio):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis = await analysis_of(db, team_a, anna, storage_key="gone")
    login_as(anna)

    assert (await api.get(f"/analyses/{analysis.id}/eml")).status_code == 503
