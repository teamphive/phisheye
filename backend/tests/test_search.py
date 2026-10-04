# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime, timedelta

import pytest
from test_analyze import add, api, db, login_as, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.models.mail_attachment import MailAttachment

HASH = "3b192e256b9d34c47200e3cbb35c6db4b89e29c168eda1458fccf3c56810bc5b"


async def search(api, text: str) -> list[dict]:
    response = await api.get("/analyses/search", params={"q": text})
    assert response.status_code == 200

    return response.json()


@pytest.mark.asyncio
async def test_finds_subject_and_sender_ignoring_case(db, api):
    _, _, _, ben, analysis_b = await two_teams(db)
    login_as(ben)

    (hit,) = await search(api, "RECHN")
    assert (hit["id"], hit["field"], hit["match"]) == (
        analysis_b.id,
        "subject",
        "Rechnung",
    )

    (hit,) = await search(api, "x@exam")
    assert (hit["field"], hit["match"]) == ("sender", "x@example.com")


@pytest.mark.asyncio
async def test_hash_needs_8_characters_and_returns_the_full_hash(db, api):
    _, _, _, ben, analysis_b = await two_teams(db)
    await add(
        db,
        MailAttachment(mail_analysis_id=analysis_b.id, filename="a.pdf", sha256=HASH),
    )
    login_as(ben)

    assert await search(api, HASH[:6]) == []

    (hit,) = await search(api, HASH[:8].upper())
    assert (hit["field"], hit["match"]) == ("hash", HASH)


@pytest.mark.asyncio
async def test_one_hit_per_analysis_hash_before_sender_before_subject(db, api):
    _, team_b, _, ben, _ = await two_teams(db)
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team_b.id,
            submitted_by=ben.id,
            subject="mahnung 3b192e25",
            sender="mahnung@3b192e25.example",
        ),
    )
    await add(
        db,
        MailAttachment(mail_analysis_id=analysis.id, filename="a.pdf", sha256=HASH),
    )
    login_as(ben)

    (hit,) = await search(api, "3b192e25")
    assert hit["field"] == "hash"

    (hit,) = await search(api, "mahnung")
    assert hit["field"] == "sender"


@pytest.mark.asyncio
async def test_only_searches_the_active_team_and_skips_deleted(db, api):
    _, _, anna, ben, analysis_b = await two_teams(db)

    login_as(anna)
    assert await search(api, "rechnung") == []

    analysis_b.deleted_at = datetime.utcnow()
    await add(db, analysis_b)
    login_as(ben)
    assert await search(api, "rechnung") == []


@pytest.mark.asyncio
async def test_at_most_20_hits_newest_first(db, api):
    _, team_b, _, ben, _ = await two_teams(db)
    start = datetime(2026, 1, 1)
    await add(
        db,
        *[
            MailAnalysis(
                team_id=team_b.id,
                submitted_by=ben.id,
                subject=f"Mail {i}",
                sender="y@example.com",
                created_at=start + timedelta(minutes=i),
            )
            for i in range(25)
        ],
    )
    login_as(ben)

    hits = await search(api, "mail")

    assert len(hits) == 20
    assert hits[0]["subject"] == "Mail 24"


@pytest.mark.asyncio
async def test_wildcards_in_the_text_are_literal(db, api):
    _, _, _, ben, _ = await two_teams(db)
    login_as(ben)

    # Without escaping, %% would match every analysis
    assert await search(api, "%%") == []


@pytest.mark.asyncio
async def test_too_short_text_finds_nothing(db, api):
    _, _, _, ben, _ = await two_teams(db)
    login_as(ben)

    assert await search(api, "r") == []
