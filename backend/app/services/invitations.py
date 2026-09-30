import asyncio
import logging

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.team import Team
from ..models.team_invitation import TeamInvitation
from ..models.team_membership import TeamMembership
from ..models.user import User
from . import keycloak_admin
from .notifications import send_invitation_mail

logger = logging.getLogger(__name__)


async def accept_invitations(user: User, db: AsyncSession) -> None:
    # open invitations for the email become memberships
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


async def deliver_invitation(
    email: str, team_name: str, inviter_name: str, role: str
) -> None:
    # no account or no password yet: Keycloak mails the setup link, otherwise
    # our invitation mail. Without the service account only the latter.
    if keycloak_admin.is_configured():
        user = await keycloak_admin.find_user(email)

        if user is None:
            await keycloak_admin.send_setup_email(
                await keycloak_admin.create_user(email)
            )
            return

        if not await keycloak_admin.has_password(user["id"]):
            await keycloak_admin.send_setup_email(user["id"])
            return
    else:
        logger.warning("No Keycloak service account, the account must exist already")

    await asyncio.to_thread(send_invitation_mail, email, team_name, inviter_name, role)
