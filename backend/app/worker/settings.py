import os

from arq import cron
from arq.connections import RedisSettings

from .tasks import poll_report_mailbox


class WorkerSettings:
    cron_jobs = [
        cron(poll_report_mailbox, second=set(range(0, 60, 60))),
    ]
    redis_settings = RedisSettings.from_dsn(
        os.getenv("REDIS_URL", "redis://localhost:6379/0")
    )
