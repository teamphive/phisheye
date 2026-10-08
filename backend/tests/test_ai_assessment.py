# ruff: noqa: F811  the fixtures come from test_analyze and are used by name
import functools
import json
from email.message import EmailMessage

import httpx2
import pytest
from test_analysis_job import pending_analysis, storage  # noqa: F401
from test_analyze import api, db, login_as, two_teams  # noqa: F401
from typesafe_sdk import AsyncTypeSafeClient, RetryPolicy

from app.services import ai_assessment, mail_analysis
from app.services.ai_assessment import MAX_BODY_CHARS, assess, body_text


def answer(choice: str, confidence: float = 0.94) -> dict:
    """A response as docs/ai-assessment.md shows it."""
    return {
        "model": "jev-1.13.0",
        "answers": {
            "phishing": {
                "type": "choice",
                "choice": choice,
                "confidence": confidence,
                "probabilities": {"phishing": 0.97, "legitimate": 0.03},
            }
        },
        "usage": {"input_tokens": 412, "output_tokens": 30},
    }


@pytest.fixture
def jev(monkeypatch):
    """The real SDK, but every request goes to `reply` instead of TypeSafe."""
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    calls = []
    reply = {"response": httpx2.Response(200, json=answer("phishing"))}

    def handler(request):
        calls.append(request)
        response = reply["response"]

        if isinstance(response, Exception):
            raise response

        return response

    client = functools.partial(
        AsyncTypeSafeClient,
        transport=httpx2.MockTransport(handler),
        # no waiting between tries in the tests
        retry=RetryPolicy(max_retries=0),
    )
    monkeypatch.setattr(ai_assessment, "AsyncTypeSafeClient", client)

    return calls, reply


def mail(text="Bitte sofort bezahlen.", html: str | None = None) -> EmailMessage:
    message = EmailMessage()
    message["From"] = "DHL <rechnung@dhl-versand.top>"
    message["Reply-To"] = "billing@mail-reply-service.top"
    message["Subject"] = "Ihre Rechnung ist überfällig"
    message.set_content(text)

    if html is not None:
        message.add_alternative(html, subtype="html")

    return message


# What goes to JEV


def test_plain_text_is_preferred_over_html():
    assert body_text(mail(text="Klartext", html="<p>HTML</p>")) == "Klartext"


def test_html_only_mail_loses_tags_scripts_and_styles():
    message = EmailMessage()
    message["From"] = "a@b.de"
    message.set_content(
        "<style>p {color: red}</style><p>Hallo <b>Anna</b>,</p>"
        "<script>steal()</script><p>bitte zahlen</p>",
        subtype="html",
    )

    assert body_text(message) == "Hallo Anna , bitte zahlen"


def test_long_body_is_cut():
    assert len(body_text(mail(text="wort " * 10_000))) == MAX_BODY_CHARS


@pytest.mark.asyncio
async def test_request_is_the_documented_one(jev):
    calls, _ = jev

    await assess(mail())

    (request,) = calls
    body = json.loads(request.content)
    assert str(request.url) == "https://api.typesafe.ai/v1/systemone"
    assert request.headers["authorization"] == "Bearer test-key"
    # pinned version, not jev-latest
    assert body["model"] == "jev-1.13.0"
    assert body["state"] == {
        "from": "DHL <rechnung@dhl-versand.top>",
        "reply_to": "billing@mail-reply-service.top",
        "subject": "Ihre Rechnung ist überfällig",
        "body": "Bitte sofort bezahlen.",
    }
    question = body["questions"]["phishing"]
    assert question["type"] == "choice"
    assert set(question["criteria"]) == {"phishing", "legitimate"}


# What comes back


@pytest.mark.asyncio
async def test_phishing_answer(jev):
    assert await assess(mail()) == {
        "verdict": "phishing",
        "confidence": 0.94,
        "model": "jev-1.13.0",
    }


@pytest.mark.asyncio
async def test_the_tokens_of_every_answer_are_counted(jev, monkeypatch):
    counted = []

    async def count(input_tokens):
        counted.append(input_tokens)

    monkeypatch.setattr(ai_assessment, "count_jev_usage", count)
    _, reply = jev
    # billed even when the answer is not to our question
    responses = [answer("phishing"), {**answer("phishing"), "answers": {}}]

    for body in responses:
        reply["response"] = httpx2.Response(200, json=body)
        await assess(mail())

    # the input_tokens of the documented response
    assert counted == [412, 412]


@pytest.mark.asyncio
async def test_legitimate_becomes_clean(jev):
    _, reply = jev
    reply["response"] = httpx2.Response(200, json=answer("legitimate", 0.61))

    result = await assess(mail())

    assert (result["verdict"], result["confidence"]) == ("clean", 0.61)


# No answer is never an error


@pytest.mark.asyncio
async def test_without_key_nothing_is_sent(jev, monkeypatch):
    calls, _ = jev
    monkeypatch.delenv("TYPESAFE_API_KEY")

    assert await assess(mail()) is None
    assert calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [
        httpx2.Response(401, json={"error": "invalid api key"}),
        httpx2.Response(429, json={"error": "rate limited"}),
        httpx2.Response(529, json={"error": "overloaded"}),
        httpx2.ConnectError("no network"),
        # an answer, but not to our question
        httpx2.Response(200, json={**answer("phishing"), "answers": {}}),
    ],
)
async def test_failure_gives_none(jev, response):
    _, reply = jev
    reply["response"] = response

    assert await assess(mail()) is None


# In the analysis


@pytest.mark.asyncio
async def test_job_stores_the_assessment(db, api, storage, monkeypatch):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    async def fake_assess(msg):
        return {"verdict": "phishing", "confidence": 0.94, "model": "jev-1.13.0"}

    monkeypatch.setattr(mail_analysis, "assess", fake_assess)

    await mail_analysis.run_analysis(analysis_id, db)

    login_as(anna)
    detail = (await api.get(f"/analyses/{analysis_id}")).json()
    assert detail["ai_assessment"] == {
        "verdict": "phishing",
        "confidence": 0.94,
        "model": "jev-1.13.0",
    }


@pytest.mark.asyncio
async def test_jev_never_changes_score_or_verdict(db, api, storage, monkeypatch):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    async def fake_assess(msg):
        return {"verdict": "phishing", "confidence": 1.0, "model": "jev-1.13.0"}

    monkeypatch.setattr(mail_analysis, "assess", fake_assess)

    await mail_analysis.run_analysis(analysis_id, db)

    login_as(anna)
    detail = (await api.get(f"/analyses/{analysis_id}")).json()
    # the test mail passes all four rules, JEV's "phishing" does not count
    assert (detail["score"], detail["verdict"]) == (0, "clean")


@pytest.mark.asyncio
async def test_without_answer_the_analysis_still_completes(db, api, storage):
    team_a, _, anna, _, _ = await two_teams(db)
    analysis_id = await pending_analysis(db, storage, team_a, anna)

    # no TYPESAFE_API_KEY in the tests, so JEV is not asked
    await mail_analysis.run_analysis(analysis_id, db)

    login_as(anna)
    detail = (await api.get(f"/analyses/{analysis_id}")).json()
    assert detail["status"] == "completed"
    assert detail["ai_assessment"] is None
