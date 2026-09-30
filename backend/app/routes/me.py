import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services.auth import get_current_user
from ..services.instance import instance_role
from ..services.teams import initials, memberships_of, pick_active

logger = logging.getLogger(__name__)

router = APIRouter(tags=["me"])


class UpdateMeRequest(BaseModel):
    name: str


class SelectTeamRequest(BaseModel):
    team_id: int


# own teams, and for the instance admin and auditor every team
async def _teams_for(user: User, instance: str | None, db: AsyncSession) -> list[dict]:
    own = {m.team_id: m.role for m in await memberships_of(user, db)}

    teams = await db.exec(
        select(Team).where(Team.deleted_at.is_(None)).order_by(Team.id)
    )
    counts = await db.exec(
        select(TeamMembership.team_id, func.count()).group_by(TeamMembership.team_id)
    )
    member_counts = dict(counts.all())

    return [
        {
            "id": team.id,
            "name": team.name,
            "member_count": member_counts.get(team.id, 0),
            "role": own.get(team.id, instance),
            "via_instance": team.id not in own,
        }
        for team in teams.all()
        if team.id in own or instance
    ]


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    active = pick_active(user, await memberships_of(user, db))
    instance = await instance_role(user.id, db)
    teams = await _teams_for(user, instance, db)

    # an instance member may have a team active that is not theirs
    active_id = active.team_id if active else None
    if user.active_team_id in {team["id"] for team in teams}:
        active_id = user.active_team_id

    return {
        "name": user.name,
        "email": user.email,
        "initials": initials(user.name),
        "is_operator": user.is_operator,
        "instance_role": instance,
        "can_create_teams": instance == "admin",
        "teams": teams,
        "active_team_id": active_id,
    }


@router.post("/me/team", status_code=204)
async def select_team(
    payload: SelectTeamRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():
        memberships = await memberships_of(user, db)

        if not any(m.team_id == payload.team_id for m in memberships):
            role = await instance_role(user.id, db)
            team = await db.get(Team, payload.team_id) if role else None

            # Same answer as for a team that does not exist, so nobody can probe
            # for the ids of other teams
            if team is None or team.deleted_at is not None:
                raise HTTPException(status_code=404, detail="Team not found")

            logger.info("Instance %s %s enters team %s", role, user.email, team.id)

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
