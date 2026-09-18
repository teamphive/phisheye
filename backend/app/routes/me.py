from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services.auth import get_current_user

router = APIRouter(tags=["me"])


class UpdateMeRequest(BaseModel):
    name: str


def _initials(name: str) -> str:
    letters = "".join(part[0] for part in name.split() if part)
    return (letters[:2] or "?").upper()


async def _teams_for(user: User, db: AsyncSession) -> list[dict]:
    memberships_result = await db.exec(
        select(TeamMembership, Team).join(Team, Team.id == TeamMembership.team_id)
    )
    all_memberships = memberships_result.all()

    member_counts: dict[int, int] = {}
    for membership, _ in all_memberships:
        member_counts[membership.team_id] = member_counts.get(membership.team_id, 0) + 1

    return [
        {
            "id": team.id,
            "name": team.name,
            "member_count": member_counts[team.id],
            "role": membership.role,
        }
        for membership, team in all_memberships
        if membership.user_id == user.id
    ]


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {
        "name": user.name,
        "email": user.email,
        "initials": _initials(user.name),
        "is_operator": user.is_operator,
        "teams": await _teams_for(user, db),
    }


@router.patch("/me")
async def update_me(
    payload: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():
        user.name = payload.name
        db.add(user)

    return {"name": user.name}
