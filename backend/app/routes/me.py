from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services.auth import get_current_user
from ..services.teams import initials, memberships_of, pick_active

router = APIRouter(tags=["me"])


class UpdateMeRequest(BaseModel):
    name: str


class SelectTeamRequest(BaseModel):
    team_id: int


async def _teams_for(user: User, db: AsyncSession) -> list[dict]:
    memberships_result = await db.exec(
        select(TeamMembership, Team)
        .join(Team, Team.id == TeamMembership.team_id)
        .where(Team.deleted_at.is_(None))
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
    active = pick_active(user, await memberships_of(user, db))

    return {
        "name": user.name,
        "email": user.email,
        "initials": initials(user.name),
        "is_operator": user.is_operator,
        "teams": await _teams_for(user, db),
        "active_team_id": active.team_id if active else None,
    }


@router.post("/me/team", status_code=204)
async def select_team(
    payload: SelectTeamRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():
        memberships = await memberships_of(user, db)

        # Same answer as for a team that does not exist, so nobody can probe
        # for the ids of other teams
        if not any(m.team_id == payload.team_id for m in memberships):
            raise HTTPException(status_code=404, detail="Team not found")

        user.active_team_id = payload.team_id
        db.add(user)


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
