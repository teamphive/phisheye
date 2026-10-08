from datetime import datetime

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from sqlalchemy import update
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.notification import Notification
from ..models.user import User
from ..services.auth import get_current_user
from ..services.bell import oldest_kept

router = APIRouter(tags=["notifications"])

# 14 days of a busy team fit, the bell shows only the first few anyway
MAX_ENTRIES = 100


class ReadRequest(BaseModel):
    ids: list[int]


def _entry(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "kind": notification.kind,
        "tone": notification.tone,
        "title": notification.title,
        "detail": notification.detail,
        "target": notification.target,
        "created_at": notification.created_at,
        "read": notification.read_at is not None,
    }


# Per person, not per team: "added you to a team" also reaches someone who has
# no team yet, so only the user is needed, not the active membership
@router.get("/notifications")
async def list_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One's own entries of the last 14 days, unread first, newest first."""
    result = await db.exec(
        select(Notification)
        .where(Notification.user_id == user.id)
        # the cleanup runs at night, until then the age is checked here
        .where(Notification.created_at >= oldest_kept())
        # false before true: entries without read_at come first
        .order_by(Notification.read_at.is_not(None), Notification.created_at.desc())
        .limit(MAX_ENTRIES)
    )

    return [_entry(notification) for notification in result.all()]


@router.post("/notifications/read", status_code=204)
async def mark_read(
    payload: ReadRequest | None = Body(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marks the given entries as read, all of them without a body."""
    query = (
        update(Notification)
        # someone else's ids are simply not touched
        .where(Notification.user_id == user.id)
        # read stays read, the first time is kept
        .where(Notification.read_at.is_(None))
    )

    if payload is not None:
        query = query.where(Notification.id.in_(payload.ids))

    async with db.begin():
        await db.execute(query.values(read_at=datetime.utcnow()))
