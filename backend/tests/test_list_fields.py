# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import pytest
from test_analysis_job import mail, storage  # noqa: F401
from test_analyze import add, api, db, join, login_as, two_teams  # noqa: F401
from test_assignment import setup

from app.models.team_membership import TeamMembership
from app.models.user import User


def url(analysis) -> str:
    return f"/analyses/{analysis.id}"


async def list_item(api, analysis):
    items = (await api.get("/analyses")).json()
    return next(item for item in items if item["id"] == analysis.id)


@pytest.mark.asyncio
async def test_an_undecided_analysis_has_no_decision_and_is_nobodys(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)

    item = await list_item(api, analysis)

    assert item["decision"] is None
    assert item["mine"] is False
    assert item["handler"] is None


@pytest.mark.asyncio
async def test_the_list_carries_the_decision_with_the_name(db, api):
    analysis, anna, carl, *_ = await setup(db)
    login_as(anna)
    await api.post(f"{url(analysis)}/assignment")
    await api.post(f"{url(analysis)}/decision", json={"verdict": "phishing"})

    item = await list_item(api, analysis)

    # the same shape as in the detail
    detail = (await api.get(url(analysis))).json()
    assert item["decision"]["verdict"] == "phishing"
    assert item["decision"]["by"] == "Anna"
    assert item["decision"] == detail["decision"]

    # whoever else looks at the list sees it too
    login_as(carl)
    assert (await list_item(api, analysis))["decision"]["by"] == "Anna"


@pytest.mark.asyncio
async def test_the_decision_disappears_when_it_is_taken_back(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)
    await api.post(f"{url(analysis)}/assignment")
    await api.post(f"{url(analysis)}/decision", json={"verdict": "clean"})
    await api.delete(f"{url(analysis)}/decision")

    assert (await list_item(api, analysis))["decision"] is None


@pytest.mark.asyncio
async def test_mine_is_true_only_for_the_assigned_person(db, api):
    analysis, anna, carl, *_ = await setup(db)
    login_as(anna)
    await api.post(f"{url(analysis)}/assignment")

    assert (await list_item(api, analysis))["mine"] is True
    assert (await api.get(url(analysis))).json()["mine"] is True

    login_as(carl)
    assert (await list_item(api, analysis))["mine"] is False
    assert (await api.get(url(analysis))).json()["mine"] is False


@pytest.mark.asyncio
async def test_two_people_with_the_same_name_do_not_share_an_analysis(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)
    await api.post(f"{url(analysis)}/assignment")

    # another Anna in the same team
    (second,) = await add(
        db, User(email="anna.zwei@example.com", name="Anna", password_hash="")
    )
    await add(
        db, TeamMembership(team_id=analysis.team_id, user_id=second.id, role="analyst")
    )
    login_as(second)

    item = await list_item(api, analysis)

    # the names match, the person does not
    assert item["handler"] == "Anna"
    assert item["mine"] is False


@pytest.mark.asyncio
async def test_search_hits_carry_both_fields(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)
    await api.post(f"{url(analysis)}/assignment")
    await api.post(f"{url(analysis)}/decision", json={"verdict": "phishing"})

    (hit,) = (await api.get("/analyses/search", params={"q": "Rechnung"})).json()

    assert hit["mine"] is True
    assert hit["decision"]["verdict"] == "phishing"
    assert hit["decision"]["by"] == "Anna"


@pytest.mark.asyncio
async def test_a_new_upload_is_mine(db, api, storage):
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.post(
        "/analyses", files={"file": ("mail.eml", mail(), "message/rfc822")}
    )

    assert response.json()["mine"] is True
    assert response.json()["decision"] is None
