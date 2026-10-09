from fastapi import APIRouter, Depends, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..services import health

router = APIRouter(tags=["health"])


@router.get("/health/ready")
async def ready(response: Response, db: AsyncSession = Depends(get_db)):
    """200 while the app can work, 503 when a service it needs is down.

    Public on purpose, so it carries only the one word. The state of each
    service is in GET /monitoring, behind the login.
    """
    status = await health.public_status(db)

    if status == "down":
        response.status_code = 503

    return {"status": status}
