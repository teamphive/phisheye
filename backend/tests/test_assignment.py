# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import pytest
from test_analysis_job import mail, storage  # noqa: F401
from test_analyze import add, api, db, join, login_as, two_teams  # noqa: F401

from app.models.mail_analysis import MailAnalysis
from app.services import mail_analysis


async def setup(db, **fields):
    """Anna and Carl are analysts in Team A, Ute audits, one analysis of A."""
    team_a, _, anna, ben, analysis_b = await two_teams(db)
    carl = await join(db, team_a, "analyst", "Carl")
    ute = await join(db, team_a, "audit", "Ute")
    (analysis,) = await add(
        db,
        MailAnalysis(
            team_id=team_a.id,
            submitted_by=anna.id,
            subject="Rechnung",
            sender="x@example.com",
            status="completed",
            **fields,
        ),
    )

    return analysis, anna, carl, ute, analysis_b


def url(analysis) -> str:
    return f"/analyses/{analysis.id}/assignment"


async def handler_of(api, analysis):
    return (await api.get(f"/analyses/{analysis.id}")).json()["handler"]


# Übernehmen


@pytest.mark.asyncio
async def test_take_on(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)

    response = await api.post(url(analysis))

    assert response.status_code == 200
    assert response.json() == {"handler": "Anna"}
    assert await handler_of(api, analysis) == "Anna"
    # taking it on again is fine
    assert (await api.post(url(analysis))).status_code == 200


@pytest.mark.asyncio
async def test_take_on_from_someone_else(db, api):
    analysis, anna, carl, *_ = await setup(db)
    login_as(anna)
    await api.post(url(analysis))

    login_as(carl)
    response = await api.post(url(analysis))

    # no question asked here, the frontend asks before
    assert response.json() == {"handler": "Carl"}


# Abgeben


@pytest.mark.asyncio
async def test_hand_back(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)
    await api.post(url(analysis))

    response = await api.delete(url(analysis))

    assert response.status_code == 204
    assert await handler_of(api, analysis) is None
    # nobody assigned, still 204
    assert (await api.delete(url(analysis))).status_code == 204


@pytest.mark.asyncio
async def test_cannot_hand_back_someone_elses(db, api):
    analysis, anna, carl, *_ = await setup(db)
    login_as(anna)
    await api.post(url(analysis))

    login_as(carl)
    response = await api.delete(url(analysis))

    assert response.status_code == 403
    assert await handler_of(api, analysis) == "Anna"


# Rollen, Teams, Entscheidung


@pytest.mark.asyncio
async def test_audit_cannot_take_on_or_hand_back(db, api):
    analysis, _, _, ute, _ = await setup(db)
    login_as(ute)

    assert (await api.post(url(analysis))).status_code == 403
    assert (await api.delete(url(analysis))).status_code == 403


@pytest.mark.asyncio
async def test_other_teams_analysis_is_not_found(db, api):
    _, anna, _, _, analysis_b = await setup(db)
    login_as(anna)

    assert (await api.post(url(analysis_b))).status_code == 404
    assert (await api.delete(url(analysis_b))).status_code == 404


@pytest.mark.asyncio
async def test_a_decided_analysis_can_be_taken_over_but_not_handed_back(db, api):
    analysis, anna, carl, *_ = await setup(db)
    login_as(anna)
    await api.post(url(analysis))
    await api.post(f"/analyses/{analysis.id}/decision", json={"verdict": "phishing"})

    # a colleague can take it over, so it never gets stuck with someone absent
    login_as(carl)
    assert (await api.post(url(analysis))).status_code == 200
    assert await handler_of(api, analysis) == "Carl"
    # but nobody hands a decided analysis back to nobody
    assert (await api.delete(url(analysis))).status_code == 409

    # the new owner can take the decision back, and then hand it back
    assert (await api.delete(f"/analyses/{analysis.id}/decision")).status_code == 204
    assert (await api.delete(url(analysis))).status_code == 204


@pytest.mark.asyncio
async def test_deciding_a_free_analysis_assigns_the_decider(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)

    response = await api.post(
        f"/analyses/{analysis.id}/decision", json={"verdict": "clean"}
    )

    # one click: decided and assigned in the same step
    assert response.status_code == 200
    assert response.json()["by"] == "Anna"
    detail = (await api.get(f"/analyses/{analysis.id}")).json()
    assert detail["handler"] == "Anna"
    assert detail["mine"] is True
    assert detail["decision"]["verdict"] == "clean"


@pytest.mark.asyncio
async def test_the_second_decision_on_a_free_analysis_is_refused(db, api):
    analysis, anna, carl, *_ = await setup(db)
    decision = f"/analyses/{analysis.id}/decision"

    # Anna and Carl both see it free, Anna is first
    login_as(anna)
    assert (await api.post(decision, json={"verdict": "phishing"})).status_code == 200

    login_as(carl)
    response = await api.post(decision, json={"verdict": "clean"})

    # Carl's page is out of date: 403, and nothing of his is written
    assert response.status_code == 403
    detail = (await api.get(f"/analyses/{analysis.id}")).json()
    assert detail["handler"] == "Anna"
    assert detail["mine"] is False
    assert detail["decision"]["verdict"] == "phishing"
    assert detail["decision"]["by"] == "Anna"


@pytest.mark.asyncio
async def test_a_decision_at_the_same_time_has_one_winner(db, api):
    analysis, anna, carl, *_ = await setup(db)
    decision = f"/analyses/{analysis.id}/decision"

    async def click(user, verdict):
        login_as(user)
        return (await api.post(decision, json={"verdict": verdict})).status_code

    # no real parallelism in the test database, but both requests run the same
    # single UPDATE and the loser must find the row taken
    first = await click(anna, "phishing")
    second = await click(carl, "clean")

    assert sorted([first, second]) == [200, 403]


@pytest.mark.asyncio
async def test_the_assigned_person_can_decide_again(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)
    decision = f"/analyses/{analysis.id}/decision"

    await api.post(decision, json={"verdict": "phishing"})
    response = await api.post(decision, json={"verdict": "clean"})

    assert response.status_code == 200
    detail = (await api.get(f"/analyses/{analysis.id}")).json()
    assert detail["decision"]["verdict"] == "clean"


@pytest.mark.asyncio
async def test_taking_back_without_an_assignment_stays_a_conflict(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)

    # only old data has a decision without an assignment
    assert (await api.delete(f"/analyses/{analysis.id}/decision")).status_code == 409


@pytest.mark.asyncio
async def test_only_the_assigned_person_decides_and_takes_back(db, api):
    analysis, anna, carl, *_ = await setup(db)
    decision = f"/analyses/{analysis.id}/decision"
    login_as(anna)
    await api.post(url(analysis))

    login_as(carl)
    assert (await api.post(decision, json={"verdict": "clean"})).status_code == 403

    login_as(anna)
    assert (await api.post(decision, json={"verdict": "clean"})).status_code == 200

    # Carl can neither change it nor take it back
    login_as(carl)
    assert (await api.post(decision, json={"verdict": "phishing"})).status_code == 403
    assert (await api.delete(decision)).status_code == 403
    detail = (await api.get(f"/analyses/{analysis.id}")).json()
    assert detail["decision"]["verdict"] == "clean"

    login_as(anna)
    assert (await api.delete(decision)).status_code == 204


@pytest.mark.asyncio
async def test_revoking_the_decision_keeps_the_assignment(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)
    await api.post(url(analysis))
    await api.post(f"/analyses/{analysis.id}/decision", json={"verdict": "clean"})

    await api.delete(f"/analyses/{analysis.id}/decision")

    assert await handler_of(api, analysis) == "Anna"


# Start der Zuweisung


@pytest.mark.asyncio
async def test_upload_starts_with_the_uploader(db, api, storage):
    _, _, anna, _, _ = await two_teams(db)
    login_as(anna)

    response = await api.post(
        "/analyses", files={"file": ("mail.eml", mail(), "message/rfc822")}
    )

    assert response.json()["handler"] == "Anna"
    assert await handler_of(api, MailAnalysis(id=response.json()["id"])) == "Anna"


@pytest.mark.asyncio
async def test_report_starts_with_nobody(db, api, storage):
    team_a, _, anna, _, _ = await two_teams(db)

    # Outlook report and Mailgun webhook both come in as the system user,
    # without handled_by
    for reported_by in ("m@firma.de", None):
        analysis = await mail_analysis.submit_analysis(
            content=mail(),
            team_id=team_a.id,
            submitted_by=anna.id,
            db=db,
            reported_by=reported_by,
        )
        assert analysis.handled_by is None


@pytest.mark.asyncio
async def test_list_and_search_show_the_handler(db, api):
    analysis, anna, *_ = await setup(db)
    login_as(anna)
    await api.post(url(analysis))

    (item,) = (await api.get("/analyses")).json()
    (hit,) = (await api.get("/analyses/search", params={"q": "rechnung"})).json()

    assert item["handler"] == hit["handler"] == "Anna"
