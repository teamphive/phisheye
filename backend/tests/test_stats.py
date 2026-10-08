# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime, timedelta

import pytest
from test_analyze import add, api, db, join, login_as, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis

# The page in Berlin asks for the last 7 days on 8 October 2026 at 12:00.
# Berlin is UTC+2 then, so its midnight of 2 October is 22:00 UTC on 1 October
PERIOD = {
    "from": "2026-10-01T22:00:00.000Z",
    "to": "2026-10-08T10:00:00.000Z",
    "tz": "Europe/Berlin",
}


def at(text: str) -> datetime:
    """UTC without a zone, like the database stores it."""
    return datetime.fromisoformat(text)


async def world(db):
    team_a, team_b, anna, ben, _ = await two_teams(db)

    def analysis(created, *, team=team_a, **fields):
        fields.setdefault("status", "completed")
        fields.setdefault("sender", "info@shop.de")
        return MailAnalysis(
            team_id=team.id,
            submitted_by=anna.id,
            subject="Test",
            created_at=at(created),
            **fields,
        )

    await add(
        db,
        # 00:30 in Berlin on 2 October, still 1 October in UTC
        analysis("2026-10-01T22:30:00", verdict="phishing", sender="DHL <a@Evil.TOP>"),
        # a false positive: the detection said phishing, the analyst clean
        analysis(
            "2026-10-03T10:00:00",
            verdict="phishing",
            decided_verdict="clean",
            decided_by=anna.id,
            decided_at=at("2026-10-03T10:30:00"),
        ),
        analysis(
            "2026-10-04T10:00:00",
            verdict="suspicious",
            decided_verdict="phishing",
            decided_by=anna.id,
            decided_at=at("2026-10-04T11:30:00"),
            sender="x@evil.top",
        ),
        analysis("2026-10-05T10:00:00", verdict="clean", reported_by="m@firma.de"),
        # analysed before the detection existed
        analysis("2026-10-06T10:00:00", verdict=None),
        # not counted: running, failed, deleted, another team
        analysis("2026-10-06T11:00:00", status="processing"),
        analysis("2026-10-06T12:00:00", status="failed"),
        analysis(
            "2026-10-06T13:00:00",
            verdict="phishing",
            deleted_at=at("2026-10-07T00:00:00"),
        ),
        analysis("2026-10-06T14:00:00", team=team_b, verdict="phishing"),
        # the period before: [24 September 22:00, 1 October 22:00)
        analysis("2026-09-28T10:00:00", verdict="phishing"),
        # long ago and still undecided, only in open
        analysis("2026-08-01T10:00:00", verdict="suspicious"),
    )

    return team_a, anna


@pytest.mark.asyncio
async def test_stats_of_the_period(db, api):
    _, anna = await world(db)
    login_as(anna)

    response = await api.get("/stats", params=PERIOD)

    assert response.status_code == 200
    stats = response.json()
    # decisions count over the detection: 1 detected, 1 decided phishing
    assert stats["counts"] == {"phishing": 2, "suspicious": 0, "clean": 2, "unrated": 1}
    assert stats["previous"] == {
        "phishing": 1,
        "suspicious": 0,
        "clean": 0,
        "unrated": 0,
    }
    assert stats["decided"] == 2
    # of the two flagged and decided, one was set to clean
    assert stats["false_positive_rate"] == 0.5
    # 30 and 90 minutes
    assert stats["median_decision_minutes"] == 60.0
    # lower case, the false positive does not count
    assert stats["top_domains"] == [{"domain": "evil.top", "count": 2}]
    assert stats["sources"] == {"upload": 4, "report": 1}


@pytest.mark.asyncio
async def test_daily_has_every_day_in_the_browsers_time_zone(db, api):
    _, anna = await world(db)
    login_as(anna)

    daily = (await api.get("/stats", params=PERIOD)).json()["daily"]

    assert [day["day"] for day in daily] == [
        "2026-10-02",
        "2026-10-03",
        "2026-10-04",
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
    ]
    # the mail of 22:30 UTC belongs to 2 October in Berlin
    assert daily[0] == {
        "day": "2026-10-02",
        "phishing": 1,
        "suspicious": 0,
        "clean": 0,
        "unrated": 0,
    }
    # a day without analyses still has its entry
    assert daily[5] == {
        "day": "2026-10-07",
        "phishing": 0,
        "suspicious": 0,
        "clean": 0,
        "unrated": 0,
    }


@pytest.mark.asyncio
async def test_open_does_not_depend_on_the_period(db, api):
    _, anna = await world(db)
    login_as(anna)

    open_ = (await api.get("/stats", params=PERIOD)).json()["open"]

    # undecided and completed, the one from August and the one before included
    assert open_["total"] == 5
    assert [item["received_at"] for item in open_["items"]] == [
        "2026-10-06T10:00:00",
        "2026-10-05T10:00:00",
        "2026-10-01T22:30:00",
        "2026-09-28T10:00:00",
        "2026-08-01T10:00:00",
    ]
    assert set(open_["items"][0]) == {
        "id",
        "subject",
        "sender",
        "status",
        "verdict",
        "score",
        "received_at",
    }


@pytest.mark.asyncio
async def test_without_decisions_the_rates_are_null(db, api):
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    stats = (await api.get("/stats", params=PERIOD)).json()

    assert stats["decided"] == 0
    assert stats["false_positive_rate"] is None
    assert stats["median_decision_minutes"] is None
    assert stats["top_domains"] == []
    assert len(stats["daily"]) == 7


@pytest.mark.asyncio
async def test_audit_may_read_the_stats(db, api):
    team_a, _ = await world(db)
    auditor = await join(db, team_a, "audit", "Ute")
    login_as(auditor)

    assert (await api.get("/stats", params=PERIOD)).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "change",
    [
        {"tz": "Mars/Olympus"},
        {"from": "2026-10-08T10:00:00Z", "to": "2026-10-01T22:00:00Z"},
        {"from": "2020-01-01T00:00:00Z"},
        {"from": "gestern"},
    ],
)
async def test_bad_parameters_are_rejected(db, api, change):
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.get("/stats", params={**PERIOD, **change})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_parameters_are_required(db, api):
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    assert (await api.get("/stats")).status_code == 422


@pytest.mark.asyncio
async def test_period_up_to_midnight_does_not_get_the_next_day(db, api):
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)
    end = datetime(2026, 10, 7, 22, 0)

    response = await api.get(
        "/stats",
        params={
            "from": (end - timedelta(days=1)).isoformat() + "Z",
            "to": end.isoformat() + "Z",
            "tz": "Europe/Berlin",
        },
    )

    # exactly 7 October in Berlin, 8 October has not begun
    assert [day["day"] for day in response.json()["daily"]] == ["2026-10-07"]
