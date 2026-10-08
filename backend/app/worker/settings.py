from arq import cron

from ..constants import WORKER_MAX_JOBS
from ..services.notifications import redis_settings
from .tasks import (
    analyze_mail,
    poll_report_mailbox,
    send_decision_mail,
    send_failure_mail,
    send_team_invitation,
)


class WorkerSettings:
    functions = [
        analyze_mail,
        send_decision_mail,
        send_failure_mail,
        send_team_invitation,
    ]
    cron_jobs = [
        cron(poll_report_mailbox, second={0, 30}),
    ]
    max_tries = 5
    max_jobs = WORKER_MAX_JOBS
    redis_settings = redis_settings()
