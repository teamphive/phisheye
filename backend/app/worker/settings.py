from arq import cron

from ..constants import WORKER_MAX_JOBS
from ..services.notifications import redis_settings
from .tasks import (
    analyze_mail,
    delete_old_notifications,
    poll_report_mailbox,
    send_decision_mail,
    send_failure_mail,
    send_receipt_mail,
    send_team_invitation,
)


class WorkerSettings:
    functions = [
        analyze_mail,
        send_decision_mail,
        send_failure_mail,
        send_receipt_mail,
        send_team_invitation,
    ]
    cron_jobs = [
        cron(poll_report_mailbox, second={0, 30}),
        # at night, once a day is enough for a 14 day limit
        cron(delete_old_notifications, hour={3}, minute={0}),
    ]
    max_tries = 5
    # GET /monitoring reads the health key, the default of an hour would show
    # a stopped worker as running for up to an hour
    health_check_interval = 60
    max_jobs = WORKER_MAX_JOBS
    redis_settings = redis_settings()
