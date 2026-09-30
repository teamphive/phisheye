from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.team import Team
from ..models.team_invitation import TeamInvitation
from ..models.team_membership import TeamMembership
from ..models.user import User


async def accept_invitations(user: User, db: AsyncSession) -> None:
    """Turns the open invitations for the user's email into memberships.

    Runs inside the transaction of the caller. Teams that were deleted since
    are skipped, an invitation that is already a membership just disappears.
    """
    result = await db.exec(
        select(TeamInvitation, Team)
        .join(Team, Team.id == TeamInvitation.team_id)
        .where(TeamInvitation.email == user.email.lower())
        .order_by(TeamInvitation.id)
    )
    invitations = result.all()

    if not invitations:
        return

    member_result = await db.exec(
        select(TeamMembership.team_id).where(TeamMembership.user_id == user.id)
    )
    member_of = set(member_result.all())

    for invitation, team in invitations:
        if team.deleted_at is None and team.id not in member_of:
            db.add(
                TeamMembership(team_id=team.id, user_id=user.id, role=invitation.role)
            )
            member_of.add(team.id)

            if user.active_team_id is None:
                user.active_team_id = team.id

        await db.delete(invitation)
