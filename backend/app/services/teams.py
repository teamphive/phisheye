from fastapi import Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.team_membership import TeamMembership
from ..models.user import User
from .auth import get_current_user


# all team memberships of a user, ordered by creation time
async def memberships_of(user: User, db: AsyncSession) -> list[TeamMembership]:
    result = await db.exec(
        select(TeamMembership)
        .where(TeamMembership.user_id == user.id)
        .order_by(TeamMembership.id)
    )
    return list(result.all())


def pick_active(user: User, memberships: list[TeamMembership]) -> TeamMembership | None:
    """The membership the server answers for.

    Falls back to the oldest membership when the user never picked a team or
    was removed from the picked one. Without any team there is none.
    """
    for membership in memberships:
        if membership.team_id == user.active_team_id:
            return membership

    return memberships[0] if memberships else None


async def get_active_membership(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMembership:
    """Team and role for the current request, 403 for a user without a team."""
    # Own transaction, otherwise the route could not open one afterwards
    async with db.begin():
        membership = pick_active(user, await memberships_of(user, db))

    if membership is None:
        raise HTTPException(status_code=403, detail="You are not in any team yet")

    return membership
