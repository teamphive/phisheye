"""The numbers of the overview page, see GET /stats in docs/api.md.

Everything is counted in Python, not in SQL: a team has a few hundred analyses
in a period, and Python knows time zones and medians the same way on Postgres
and on SQLite in the tests.
"""

from collections import Counter
from datetime import date, datetime, timedelta, timezone
from email.utils import parseaddr
from statistics import median
from zoneinfo import ZoneInfo

from ..models.mail_analysis import MailAnalysis

VERDICTS = ("phishing", "suspicious", "clean")
TOP_DOMAINS = 5


def to_utc(value: datetime) -> datetime:
    """The database stores UTC without a zone, the frontend sends it with Z."""
    if value.tzinfo is None:
        return value

    return value.astimezone(timezone.utc).replace(tzinfo=None)


def final_verdict(analysis: MailAnalysis) -> str | None:
    """The analyst's decision counts over the detection.

    suspicious therefore only comes from the detection, an analyst decides
    phishing or clean.
    """
    return analysis.decided_verdict or analysis.verdict


def verdict_counts(analyses: list[MailAnalysis]) -> dict:
    counts = {verdict: 0 for verdict in VERDICTS}
    counts["unrated"] = 0

    for analysis in analyses:
        # no verdict and no decision, e.g. analysed before the detection existed
        counts[final_verdict(analysis) or "unrated"] += 1

    return counts


def daily_counts(
    analyses: list[MailAnalysis], start: datetime, end: datetime, tz: ZoneInfo
) -> list[dict]:
    """One entry per calendar day in the browser's time zone, oldest first."""

    def local_day(value: datetime) -> date:
        return value.replace(tzinfo=timezone.utc).astimezone(tz).date()

    by_day: dict[date, list[MailAnalysis]] = {}
    for analysis in analyses:
        by_day.setdefault(local_day(analysis.created_at), []).append(analysis)

    days = []
    day = local_day(start)
    # `end` is excluded, a period up to midnight does not get the next day
    last = local_day(end - timedelta(microseconds=1))

    while day <= last:
        # days without analyses get zeros, the chart needs every day
        days.append({"day": day.isoformat(), **verdict_counts(by_day.get(day, []))})
        day += timedelta(days=1)

    return days


def false_positive_rate(decided: list[MailAnalysis]) -> float | None:
    """Of the detection's phishing and suspicious, how many an analyst set to clean."""
    flagged = [a for a in decided if a.verdict in ("phishing", "suspicious")]

    if not flagged:
        return None

    return sum(1 for a in flagged if a.decided_verdict == "clean") / len(flagged)


def median_decision_minutes(decided: list[MailAnalysis]) -> float | None:
    if not decided:
        return None

    minutes = [(a.decided_at - a.created_at).total_seconds() / 60 for a in decided]
    return round(median(minutes), 1)


def sender_domain(sender: str) -> str | None:
    _, address = parseaddr(sender)

    if "@" not in address:
        return None

    return address.rsplit("@", 1)[1].lower()


def top_domains(analyses: list[MailAnalysis]) -> list[dict]:
    counter = Counter(
        domain
        for analysis in analyses
        if final_verdict(analysis) == "phishing"
        and (domain := sender_domain(analysis.sender))
    )

    # most frequent first, the same count sorted by name so the order is stable
    ranked = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    return [
        {"domain": domain, "count": count} for domain, count in ranked[:TOP_DOMAINS]
    ]


def period_stats(
    current: list[MailAnalysis],
    previous: list[MailAnalysis],
    start: datetime,
    end: datetime,
    tz: ZoneInfo,
) -> dict:
    """Everything of the response that depends on the period."""
    decided = [a for a in current if a.decided_verdict is not None]

    return {
        "counts": verdict_counts(current),
        "previous": verdict_counts(previous),
        "daily": daily_counts(current, start, end, tz),
        "decided": len(decided),
        "false_positive_rate": false_positive_rate(decided),
        "median_decision_minutes": median_decision_minutes(decided),
        "top_domains": top_domains(current),
        "sources": {
            "upload": sum(1 for a in current if not a.reported_by),
            "report": sum(1 for a in current if a.reported_by),
        },
    }
