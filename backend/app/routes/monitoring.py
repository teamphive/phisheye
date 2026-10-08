from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from ..constants import WORKER_MAX_JOBS
from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.user import User
from ..services.auth import get_current_user
from ..services.mail_analysis import requeue_analysis
from ..services.monitoring import last_day, queue_counts, services, vt_limit, vt_used

router = APIRouter(tags=["monitoring"])


async def get_operator(user: User = Depends(get_current_user)) -> User:
    """Operators only: the realm role operator or the instance admin.

    Not tied to a team, the monitoring shows all teams at once.
    """
    if not user.is_operator:
        raise HTTPException(status_code=403, detail="Only operators see the monitoring")

    return user


@router.get("/monitoring")
async def get_monitoring(
    _: User = Depends(get_operator),
    db: AsyncSession = Depends(get_db),
):
    waiting, busy = await queue_counts(db)
    day = await last_day(db)
    used = await vt_used()

    return {
        "queue": {"waiting": waiting},
        "workers": {"busy": busy, "total": WORKER_MAX_JOBS},
        "jobs": day["jobs"],
        # 0 if Redis does not answer, the services list then shows Redis down
        "virus_total": {"used": used or 0, "limit": vt_limit()},
        "hourly": day["hourly"],
        "services": await services(db, used),
        "failures": day["failures"],
    }


@router.post("/monitoring/jobs/{analysis_id}/retry", status_code=204)
async def retry_job(
    analysis_id: int,
    _: User = Depends(get_operator),
    db: AsyncSession = Depends(get_db),
):
    """Puts a failed analysis back into the queue, with three fresh tries.

    The id is the analysis id, that is what the failure list hands out.
    """
    async with db.begin():
        analysis = await db.get(MailAnalysis, analysis_id)

        if analysis is None or analysis.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Analysis not found")

        if analysis.status != "failed":
            raise HTTPException(status_code=409, detail="Only failed analyses restart")

        # a fresh start: the error goes, the duration counts from the new run
        analysis.status = "pending"
        analysis.error = None
        analysis.step = None
        analysis.started_at = None
        db.add(analysis)

    try:
        await requeue_analysis(analysis_id)
    except Exception as exc:
        # without the queue the analysis would wait forever, so it stays failed
        async with db.begin():
            analysis = await db.get(MailAnalysis, analysis_id)
            analysis.status = "failed"
            db.add(analysis)
        raise HTTPException(status_code=503, detail="Queue is not available") from exc
