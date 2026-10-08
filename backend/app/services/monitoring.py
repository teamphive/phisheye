"""What GET /monitoring shows, system-wide across all teams.

Only what an operator has to know or do right now. History, latencies and
alerts live in Grafana.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta

import boto3
from botocore.config import Config
from redis.asyncio import Redis
from sqlalchemy import func, text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.mail_analysis import MailAnalysis

logger = logging.getLogger(__name__)

# The free VirusTotal key allows 500 lookups a day, a paid one sets its own
VT_DAILY_LIMIT_DEFAULT = 500
# arq writes this key while a worker runs, see WorkerSettings
WORKER_HEALTH_KEY = "arq:queue:health-check"
# the page asks every 10 seconds, a check must never hold it up
CHECK_TIMEOUT_SECONDS = 2
# a failure text is shown as it is, it must not grow into a mail
MAX_ERROR_CHARS = 200


def _redis() -> Redis:
    return Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))


def _vt_key(day: datetime) -> str:
    # VirusTotal counts by UTC day
    return f"vt:used:{day:%Y-%m-%d}"


# VirusTotal quota


def vt_limit() -> int:
    return int(os.getenv("VT_DAILY_LIMIT", VT_DAILY_LIMIT_DEFAULT))


async def count_vt_lookup() -> None:
    """One more lookup today. Never fails the analysis, counting is a bonus."""
    try:
        async with _redis() as redis:
            key = _vt_key(datetime.utcnow())
            await redis.incr(key)
            # two days, so yesterday's number is still there right after midnight
            await redis.expire(key, 2 * 24 * 3600)
    except Exception:
        logger.warning("Could not count the VirusTotal lookup")


async def vt_used() -> int | None:
    """Today's lookups, None if Redis does not answer."""
    try:
        async with _redis() as redis:
            value = await redis.get(_vt_key(datetime.utcnow()))
    except Exception:
        return None

    return int(value or 0)


# Service status


async def _check(name: str, probe) -> dict:
    try:
        ok = await asyncio.wait_for(probe(), CHECK_TIMEOUT_SECONDS)
    except Exception:
        ok = False

    return {"name": name, "status": "ok" if ok else "down"}


def _minio_reachable() -> bool:
    client = boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
        region_name=os.getenv("S3_REGION", "us-east-1"),
        # one quick try, boto3 would otherwise retry for a long time
        config=Config(connect_timeout=1, read_timeout=1, retries={"max_attempts": 1}),
    )
    client.head_bucket(Bucket=os.getenv("S3_BUCKET", ""))
    return True


async def services(db: AsyncSession, used: int | None) -> list[dict]:
    """ok, degraded or down per service. Cheap checks, nothing that costs quota."""

    async def postgres():
        await db.exec(text("SELECT 1"))
        return True

    async def redis():
        async with _redis() as client:
            return await client.ping()

    async def worker():
        # the key expires shortly after a worker stops writing it
        async with _redis() as client:
            return bool(await client.exists(WORKER_HEALTH_KEY))

    async def minio():
        return await asyncio.to_thread(_minio_reachable)

    checks = await asyncio.gather(
        _check("PostgreSQL", postgres),
        _check("Redis", redis),
        _check("Worker", worker),
        _check("MinIO", minio),
    )

    return [
        # it answers this request, so it is up
        {"name": "API (FastAPI)", "status": "ok"},
        *checks,
        _external("VirusTotal-API", "VT_API_KEY", used),
        _external("JEV (TypeSafe)", "TYPESAFE_API_KEY", None),
    ]


def _external(name: str, key: str, used: int | None) -> dict:
    """External APIs are not called, that would cost quota or money.

    Without a key the analysis runs without them, that is degraded, not down.
    VirusTotal is degraded too once 90 % of the day's quota are used.
    """
    if not os.getenv(key):
        status = "degraded"
    elif used is not None and used >= 0.9 * vt_limit():
        status = "degraded"
    else:
        status = "ok"

    return {"name": name, "status": status}


# Analyses of the last 24 hours


def _hour(value: datetime) -> datetime:
    return value.replace(minute=0, second=0, microsecond=0)


async def last_day(db: AsyncSession) -> dict:
    """jobs, hourly and failures over all teams, deleted analyses included:
    they caused the same load."""
    since = datetime.utcnow() - timedelta(hours=24)
    result = await db.exec(select(MailAnalysis).where(MailAnalysis.created_at >= since))
    analyses = result.all()

    # 24 hours, the current one last, hours without analyses with 0
    current = _hour(datetime.utcnow())
    hours = [current - timedelta(hours=offset) for offset in range(23, -1, -1)]
    counts = dict.fromkeys(hours, 0)
    for analysis in analyses:
        hour = _hour(analysis.created_at)
        if hour in counts:
            counts[hour] += 1

    finished = [a for a in analyses if a.status in ("completed", "failed")]
    failed = [a for a in analyses if a.status == "failed" and a.error]

    return {
        "jobs": {
            "failed": sum(1 for a in finished if a.status == "failed"),
            "total": len(finished),
        },
        "hourly": [{"hour": hour, "count": count} for hour, count in counts.items()],
        "failures": [_failure(a) for a in sorted(failed, key=_failed_at, reverse=True)],
    }


def _failed_at(analysis: MailAnalysis) -> str:
    return analysis.error.get("at", "")


def _failure(analysis: MailAnalysis) -> dict:
    """No subject, sender or text: only what went wrong."""
    error = analysis.error

    return {
        "id": analysis.id,
        "error": str(error.get("detail", ""))[:MAX_ERROR_CHARS],
        "attempt": error.get("attempt"),
        "max_attempts": error.get("max_attempts"),
        "at": error.get("at"),
    }


async def queue_counts(db: AsyncSession) -> tuple[int, int]:
    """Waiting and running analyses, the same numbers as GET /queue."""
    waiting = await db.exec(
        select(func.count())
        .select_from(MailAnalysis)
        .where(MailAnalysis.status == "pending")
        .where(MailAnalysis.deleted_at.is_(None))
    )
    busy = await db.exec(
        select(func.count())
        .select_from(MailAnalysis)
        .where(MailAnalysis.status == "processing")
    )

    return waiting.one(), busy.one()
