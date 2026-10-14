# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
from datetime import datetime

import pytest
from sqlmodel import select
from test_analyze import add, api, db, login_as  # noqa: F401
from test_team import team_with

from app.models.team import Team
from app.models.team_domain import TeamDomain
from app.services.domains import DomainError, normalize_domain, team_for_address


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("Firma.DE", "firma.de"),
        ("@firma.de", "firma.de"),
        ("www.firma.de.", "firma.de"),
        ("  mail.firma.de ", "mail.firma.de"),
        ("münchen.de", "xn--mnchen-3ya.de"),
    ],
)
def test_domain_is_normalized(typed, stored):
    assert normalize_domain(typed) == stored


@pytest.mark.parametrize(
    "typed",
    [
        "",
        "firma",
        "a b.de",
        "firma.de/x",
        "user@firma.de",
        "1.2.3.4",
        "gmail.com",
        "mail.web.de",
        "co.uk",
        "de",
    ],
)
def test_unusable_domain_is_refused(typed):
    with pytest.raises(DomainError):
        normalize_domain(typed)


@pytest.mark.asyncio
async def test_admin_adds_lists_and_removes_a_domain(db, api):
    _, (admin,) = await team_with(db, "admin")
    login_as(admin)

    created = await api.post("/team/domains", json={"domain": "@Firma.DE"})

    assert created.status_code == 201
    assert created.json()["domain"] == "firma.de"
    assert created.json()["added_by"] == admin.name

    listed = (await api.get("/team/domains")).json()
    assert [d["domain"] for d in listed["domains"]] == ["firma.de"]

    removed = await api.delete(f"/team/domains/{created.json()['id']}")
    assert removed.status_code == 204
    assert (await api.get("/team/domains")).json()["domains"] == []


@pytest.mark.asyncio
async def test_report_address_is_the_mailbox(db, api, monkeypatch):
    monkeypatch.setenv("POP3_USERNAME", "report@phishing.example")
    _, (admin,) = await team_with(db, "admin")
    login_as(admin)

    assert (await api.get("/team/domains")).json()["report_address"] == (
        "report@phishing.example"
    )


@pytest.mark.asyncio
async def test_only_admin_changes_domains(db, api):
    team, (admin, analyst) = await team_with(db, "admin", "analyst")
    (entry,) = await add(
        db, TeamDomain(team_id=team.id, domain="firma.de", added_by=admin.id)
    )
    login_as(analyst)

    assert (await api.get("/team/domains")).status_code == 200
    assert (await api.post("/team/domains", json={"domain": "x.de"})).status_code == 403
    assert (await api.delete(f"/team/domains/{entry.id}")).status_code == 403


@pytest.mark.asyncio
async def test_refused_domains_answer_422(db, api):
    _, (admin,) = await team_with(db, "admin")
    login_as(admin)

    for domain in ("gmail.com", "co.uk", "kein-punkt", "a@b.de"):
        response = await api.post("/team/domains", json={"domain": domain})
        assert response.status_code == 422, domain


@pytest.mark.asyncio
async def test_domain_of_another_team_in_either_direction_conflicts(db, api):
    _, (admin,) = await team_with(db, "admin")
    (other,) = await add(db, Team(name="B"))
    await add(db, TeamDomain(team_id=other.id, domain="firma.de", added_by=admin.id))
    login_as(admin)

    # the same, a subdomain and a parent of the taken one
    for domain in ("firma.de", "mail.firma.de"):
        response = await api.post("/team/domains", json={"domain": domain})
        assert response.status_code == 409, domain

    await add(
        db, TeamDomain(team_id=other.id, domain="mail.kunde.de", added_by=admin.id)
    )
    response = await api.post("/team/domains", json={"domain": "kunde.de"})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_same_domain_twice_in_one_team_conflicts(db, api):
    _, (admin,) = await team_with(db, "admin")
    login_as(admin)

    assert (
        await api.post("/team/domains", json={"domain": "firma.de"})
    ).status_code == 201
    assert (
        await api.post("/team/domains", json={"domain": "firma.de"})
    ).status_code == 409


@pytest.mark.asyncio
async def test_domain_of_another_team_is_not_found(db, api):
    _, (admin,) = await team_with(db, "admin")
    (other,) = await add(db, Team(name="B"))
    (entry,) = await add(
        db, TeamDomain(team_id=other.id, domain="firma.de", added_by=admin.id)
    )
    login_as(admin)

    assert (await api.delete(f"/team/domains/{entry.id}")).status_code == 404


@pytest.mark.asyncio
async def test_report_goes_to_the_team_of_the_reporter_domain(db):
    team, (admin,) = await team_with(db, "admin")
    await add(db, TeamDomain(team_id=team.id, domain="firma.de", added_by=admin.id))

    assert await team_for_address("anna@firma.de", db) == team.id
    assert await team_for_address("Anna@Mail.Firma.DE", db) == team.id
    assert await team_for_address("anna@andere.de", db) is None
    assert await team_for_address("anna@notfirma.de", db) is None
    assert await team_for_address(None, db) is None
    assert await team_for_address("kein-at", db) is None


@pytest.mark.asyncio
async def test_deleted_team_no_longer_gets_reports(db):
    team, (admin,) = await team_with(db, "admin")
    await add(db, TeamDomain(team_id=team.id, domain="firma.de", added_by=admin.id))
    team.deleted_at = datetime.utcnow()
    await add(db, team)

    assert await team_for_address("anna@firma.de", db) is None


@pytest.mark.asyncio
async def test_poller_routes_reports_by_domain(db, monkeypatch):
    from sqlmodel import select

    from app.worker import tasks

    team, (admin,) = await team_with(db, "admin")
    await add(db, TeamDomain(team_id=team.id, domain="firma.de", added_by=admin.id))

    def report(sender):
        return f"From: {sender}\nTo: report@phishing.example\nSubject: Fwd\n\nhi\n".encode()

    calls = []

    async def analyze(**kwargs):
        calls.append((kwargs["reported_by"], kwargs["team_id"]))

    async def session():
        yield db

    monkeypatch.setattr(
        tasks,
        "fetch_new_mails",
        lambda: [("1", report("anna@firma.de")), ("2", report("max@fremd.de"))],
    )
    monkeypatch.setattr(tasks, "submit_analysis", analyze)
    monkeypatch.setattr(tasks, "delete_mails", lambda uids: None)
    monkeypatch.setattr(tasks, "get_session", session)

    await tasks._poll_report_mailbox()

    default = (await db.exec(select(Team).where(Team.name == "Standard-Team"))).one()
    assert calls == [("anna@firma.de", team.id), ("max@fremd.de", default.id)]


@pytest.mark.asyncio
async def test_poller_goes_on_after_a_failed_mail(db, monkeypatch):
    from app.worker import tasks

    team, (admin,) = await team_with(db, "admin")
    await add(db, TeamDomain(team_id=team.id, domain="firma.de", added_by=admin.id))
    team_id = team.id  # the rollback below expires the objects of the test too

    def report(sender):
        return f"From: {sender}\nSubject: Fwd\n\nhi\n".encode()

    calls = []

    async def analyze(**kwargs):
        if not calls:
            calls.append("failed")
            # like a failed insert: the rollback expires the loaded objects
            async with db.begin():
                await db.exec(select(Team))
                raise RuntimeError("boom")

        calls.append((kwargs["team_id"], kwargs["submitted_by"]))

    async def session():
        yield db

    deleted = []
    monkeypatch.setattr(
        tasks,
        "fetch_new_mails",
        lambda: [
            ("1", report("a@fremd.de")),
            ("2", report("b@firma.de")),
            ("3", report("c@fremd.de")),
        ],
    )
    monkeypatch.setattr(tasks, "submit_analysis", analyze)
    monkeypatch.setattr(tasks, "delete_mails", deleted.append)
    monkeypatch.setattr(tasks, "get_session", session)

    await tasks._poll_report_mailbox()

    assert calls[0] == "failed"
    assert calls[1][0] == team_id
    # the default team and the system user survive the rollback
    assert all(isinstance(value, int) for value in calls[2])
    assert calls[2][0] != team_id
    # the failed mail stays in the mailbox for the next run
    assert deleted == [{"2", "3"}]


@pytest.mark.asyncio
async def test_poller_drops_a_mail_that_is_no_mail(db, monkeypatch):
    from app.services.eml_validation import InvalidEmlError
    from app.worker import tasks

    async def analyze(**kwargs):
        raise InvalidEmlError("The file is not a mail")

    async def session():
        yield db

    deleted = []
    monkeypatch.setattr(tasks, "fetch_new_mails", lambda: [("1", b"junk")])
    monkeypatch.setattr(tasks, "submit_analysis", analyze)
    monkeypatch.setattr(tasks, "delete_mails", deleted.append)
    monkeypatch.setattr(tasks, "get_session", session)

    await tasks._poll_report_mailbox()

    # it would fail on every run, so it leaves the mailbox
    assert deleted == [{"1"}]


@pytest.mark.asyncio
async def test_poller_tells_the_reporter_that_the_report_held_no_mail(db, monkeypatch):
    from app.services.eml_validation import InvalidEmlError
    from app.worker import tasks

    async def refuse(**kwargs):
        raise InvalidEmlError("The file is not a mail")

    async def session():
        yield db

    sent = []
    deleted = []

    class FakeRedis:
        def __init__(self):
            self.counts = {}

        async def incr(self, key):
            self.counts[key] = self.counts.get(key, 0) + 1
            return self.counts[key]

        async def expire(self, key, seconds):
            pass

    redis = FakeRedis()
    report = b"From: anna@firma.de\nSubject: Fwd\n\nhi\n"

    monkeypatch.setattr(tasks, "fetch_new_mails", lambda: [("1", report)] * 5)
    monkeypatch.setattr(tasks, "submit_analysis", refuse)
    monkeypatch.setattr(tasks, "delete_mails", lambda uids: deleted.append(uids))
    monkeypatch.setattr(tasks, "get_session", session)
    monkeypatch.setattr(tasks, "send_rejection_mail", sent.append)

    await tasks._poll_report_mailbox(redis)

    # dropped from the mailbox, told only as often as the limit allows
    assert deleted == [{"1"}]
    assert sent == ["anna@firma.de"] * tasks.MAX_REJECTIONS_PER_HOUR
