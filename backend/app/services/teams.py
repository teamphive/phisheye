from fastapi import Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User
from .auth import get_current_user
from .instance import instance_role


# memberships of a user in teams that still exist, ordered by creation time
async def memberships_of(user: User, db: AsyncSession) -> list[TeamMembership]:
    result = await db.exec(
        select(TeamMembership)
        .join(Team, Team.id == TeamMembership.team_id)
        .where(TeamMembership.user_id == user.id)
        .where(Team.deleted_at.is_(None))
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
    """Team and role for the current request, 403 for a user without a team.

    A member of the default team with role admin or audit may act in any team.
    For a team they do not belong to they get a membership that is not stored,
    with the role they have in the default team.
    """
    # Own transaction, otherwise the route could not open one afterwards
    async with db.begin():
        memberships = await memberships_of(user, db)
        membership = pick_active(user, memberships)

        if user.active_team_id is not None and (
            membership is None or membership.team_id != user.active_team_id
        ):
            role = await instance_role(user.id, db)
            team = await db.get(Team, user.active_team_id) if role else None

            if team is not None and team.deleted_at is None:
                membership = TeamMembership(team_id=team.id, user_id=user.id, role=role)

    if membership is None:
        raise HTTPException(status_code=403, detail="You are not in any team yet")

    return membership


# check if role is sufficient
def require_role(membership: TeamMembership, *roles: str) -> None:
    if membership.role not in roles:
        raise HTTPException(status_code=403, detail="Your role cannot do this")


def initials(name: str) -> str:
    letters = "".join(part[0] for part in name.split() if part)
    return (letters[:2] or "?").upper()
