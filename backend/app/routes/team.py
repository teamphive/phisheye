from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.team import Team
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services.auth import get_current_user
from ..services.teams import (
    get_active_membership,
    initials,
    memberships_of,
    require_role,
)

router = APIRouter(tags=["team"])

TeamName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]
Role = Literal["admin", "analyst", "audit"]


class TeamNameRequest(BaseModel):
    name: TeamName


class RoleRequest(BaseModel):
    role: Role


async def _member_count(team_id: int, db: AsyncSession) -> int:
    result = await db.exec(
        select(func.count())
        .select_from(TeamMembership)
        .where(TeamMembership.team_id == team_id)
    )
    return result.one()


async def _admin_count(team_id: int, db: AsyncSession) -> int:
    result = await db.exec(
        select(func.count())
        .select_from(TeamMembership)
        .where(TeamMembership.team_id == team_id)
        .where(TeamMembership.role == "admin")
    )
    return result.one()


async def _membership_of_user(
    user_id: int, team_id: int, db: AsyncSession
) -> TeamMembership:
    result = await db.exec(
        select(TeamMembership)
        .where(TeamMembership.team_id == team_id)
        .where(TeamMembership.user_id == user_id)
    )
    membership = result.first()

    if membership is None:
        raise HTTPException(status_code=404, detail="Member not found")

    return membership


@router.get("/team")
async def get_team(
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.exec(
        select(TeamMembership, User)
        .join(User, User.id == TeamMembership.user_id)
        .where(TeamMembership.team_id == membership.team_id)
        .order_by(TeamMembership.id)
    )
    rows = result.all()

    counts_result = await db.exec(
        select(MailAnalysis.submitted_by, func.count())
        .where(MailAnalysis.team_id == membership.team_id)
        .where(MailAnalysis.deleted_at.is_(None))
        .group_by(MailAnalysis.submitted_by)
    )
    analysis_counts = dict(counts_result.all())

    return {
        "members": [
            {
                "id": member.id,
                "name": member.name,
                "email": member.email,
                "initials": initials(member.name),
                "role": row.role,
                # TODO: ask the Keycloak admin API, the column is never set
                "two_factor_enabled": member.totp_enabled,
                "analysis_count": analysis_counts.get(member.id, 0),
                "is_self": member.id == user.id,
            }
            for row, member in rows
        ],
        # Invitations follow with their own table
        "invitations": [],
    }


@router.post("/teams", status_code=201)
async def create_team(
    payload: TeamNameRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():
        team = Team(name=payload.name)
        db.add(team)
        await db.flush()
        db.add(TeamMembership(team_id=team.id, user_id=user.id, role="admin"))

    return {"id": team.id, "name": team.name, "member_count": 1, "role": "admin"}


@router.patch("/team")
async def rename_team(
    payload: TeamNameRequest,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        team = await db.get(Team, membership.team_id)
        team.name = payload.name
        db.add(team)
        member_count = await _member_count(team.id, db)

    return {
        "id": team.id,
        "name": team.name,
        "member_count": member_count,
        "role": membership.role,
    }


@router.delete("/team", status_code=204)
async def delete_team(
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        team = await db.get(Team, membership.team_id)
        team.deleted_at = datetime.utcnow()
        db.add(team)


@router.patch("/team/members/{user_id}", status_code=204)
async def change_member_role(
    user_id: int,
    payload: RoleRequest,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        target = await _membership_of_user(user_id, membership.team_id, db)

        if (
            target.role == "admin"
            and payload.role != "admin"
            and await _admin_count(membership.team_id, db) == 1
        ):
            raise HTTPException(
                status_code=409, detail="Das Team braucht mindestens einen Admin."
            )

        target.role = payload.role
        db.add(target)


@router.delete("/team/members/{user_id}", status_code=204)
async def remove_member(
    user_id: int,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    is_self = user_id == user.id

    # anyone may leave, removing somebody else takes an admin
    if not is_self:
        require_role(membership, "admin")

    async with db.begin():
        target = await _membership_of_user(user_id, membership.team_id, db)

        if target.role == "admin" and await _admin_count(membership.team_id, db) == 1:
            raise HTTPException(
                status_code=409,
                detail="Du bist der letzte Admin. Gib die Rolle erst an jemand anderen ab."
                if is_self
                else "Das Team braucht mindestens einen Admin.",
            )

        if is_self and len(await memberships_of(user, db)) <= 1:
            raise HTTPException(
                status_code=409,
                detail="Das ist dein letztes Team. Lege erst ein anderes an oder lass dich einladen.",
            )

        removed = user if is_self else await db.get(User, user_id)
        if removed.active_team_id == membership.team_id:
            removed.active_team_id = None
            db.add(removed)

        await db.delete(target)
