from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..constants import DEFAULT_TEAM_NAME, SYSTEM_USER_EMAIL, SYSTEM_USER_NAME
from ..models.team import Team
from ..models.user import User


async def ensure_system_defaults(db: AsyncSession) -> tuple[Team, User]:
    async with db.begin():
        team_result = await db.exec(
            select(Team).where(Team.name == DEFAULT_TEAM_NAME)
        )
        team = team_result.first()

        if team is None:
            team = Team(name=DEFAULT_TEAM_NAME)
            db.add(team)
            await db.flush()

        user_result = await db.exec(
            select(User).where(User.email == SYSTEM_USER_EMAIL)
        )
        user = user_result.first()

        if user is None:
            user = User(
                email=SYSTEM_USER_EMAIL,
                name=SYSTEM_USER_NAME,
                password_hash="",
                totp_enabled=False,
                is_operator=False,
            )
            db.add(user)
            await db.flush()

    return team, user
