from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..constants import DEFAULT_TEAM_NAME
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User

# the only roles in the default team, they count for every team
INSTANCE_ROLES = ("admin", "audit")


# "admin" or "audit" if the user is a member of the default team, else None
async def instance_role(user_id: int, db: AsyncSession) -> str | None:
    result = await db.exec(
        select(TeamMembership.role)
        .join(Team, Team.id == TeamMembership.team_id)
        .where(TeamMembership.user_id == user_id)
        .where(Team.name == DEFAULT_TEAM_NAME)
        .where(Team.deleted_at.is_(None))
        .where(TeamMembership.role.in_(INSTANCE_ROLES))
    )
    return result.first()


# runs in the caller's transaction
async def get_default_team(db: AsyncSession) -> Team:
    result = await db.exec(select(Team).where(Team.name == DEFAULT_TEAM_NAME))
    team = result.first()

    if team is None:
        team = Team(name=DEFAULT_TEAM_NAME)
        db.add(team)
        await db.flush()

    return team


# the first instance admin, runs in the caller's transaction
async def make_instance_admin(user: User, db: AsyncSession) -> None:
    team = await get_default_team(db)

    result = await db.exec(
        select(TeamMembership)
        .where(TeamMembership.team_id == team.id)
        .where(TeamMembership.user_id == user.id)
    )
    membership = result.first() or TeamMembership(team_id=team.id, user_id=user.id)

    membership.role = "admin"
    db.add(membership)

    if user.active_team_id is None:
        user.active_team_id = team.id
