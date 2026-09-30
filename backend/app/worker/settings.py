from arq import cron

from ..services.notifications import redis_settings
from .tasks import poll_report_mailbox, send_analysis_ready, send_team_invitation


class WorkerSettings:
    functions = [send_analysis_ready, send_team_invitation]
    cron_jobs = [
        cron(poll_report_mailbox, second={0, 30}),
    ]
    max_tries = 5
    redis_settings = redis_settings()
