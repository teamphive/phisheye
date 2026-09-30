import logging
import os
from datetime import datetime
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..constants import DEFAULT_TEAM_NAME
from ..database import get_db
from ..models.mail_analysis import MailAnalysis
from ..models.team import Team
from ..models.team_domain import TeamDomain
from ..models.team_invitation import TeamInvitation
from ..models.team_membership import TeamMembership
from ..models.user import User
from ..services import keycloak_admin
from ..services.auth import get_current_user
from ..services.domains import DomainError, covered_by, normalize_domain
from ..services.instance import INSTANCE_ROLES, instance_role
from ..services.notifications import enqueue_team_invitation
from ..services.teams import (
    get_active_membership,
    initials,
    memberships_of,
    require_role,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["team"])

TeamName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]
Role = Literal["admin", "analyst", "audit"]


class TeamNameRequest(BaseModel):
    name: TeamName


class RoleRequest(BaseModel):
    role: Role


# no email-validator dependency, the mail server rejects what this lets through
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]


class DomainRequest(BaseModel):
    domain: str


class InviteRequest(BaseModel):
    email: Email
    role: Role


def _invitation(invitation: TeamInvitation) -> dict:
    return {
        "id": invitation.id,
        "email": invitation.email,
        "role": invitation.role,
        "invited_at": invitation.created_at,
    }


# Keycloak knows who has two factor. If it does not answer, nobody gets a
# value: unknown is better than a wrong "not set up".
async def _two_factor(keycloak_ids: list[str]) -> dict[str, bool]:
    if not keycloak_ids or not keycloak_admin.is_configured():
        return {}

    try:
        return await keycloak_admin.otp_users(keycloak_ids)
    except (keycloak_admin.KeycloakAdminError, httpx.HTTPError):
        logger.warning("Could not read two factor from Keycloak", exc_info=True)
        return {}


# the default team only knows admins and auditors, see services/instance.py
async def _check_role_for_team(team_id: int, role: str, db: AsyncSession) -> None:
    team = await db.get(Team, team_id)

    if team.name == DEFAULT_TEAM_NAME and role not in INSTANCE_ROLES:
        raise HTTPException(
            status_code=422,
            detail="Im Standard-Team gibt es nur Admins und Auditoren.",
        )


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

    invitations_result = await db.exec(
        select(TeamInvitation)
        .where(TeamInvitation.team_id == membership.team_id)
        .order_by(TeamInvitation.id)
    )

    counts_result = await db.exec(
        select(MailAnalysis.submitted_by, func.count())
        .where(MailAnalysis.team_id == membership.team_id)
        .where(MailAnalysis.deleted_at.is_(None))
        .group_by(MailAnalysis.submitted_by)
    )
    analysis_counts = dict(counts_result.all())

    two_factor = await _two_factor(
        [member.keycloak_id for _, member in rows if member.keycloak_id]
    )

    return {
        "members": [
            {
                "id": member.id,
                "name": member.name,
                "email": member.email,
                "initials": initials(member.name),
                "role": row.role,
                # false without an account, null if Keycloak did not answer
                "two_factor_enabled": (
                    two_factor.get(member.keycloak_id) if member.keycloak_id else False
                ),
                "analysis_count": analysis_counts.get(member.id, 0),
                "is_self": member.id == user.id,
            }
            for row, member in rows
        ],
        "invitations": [_invitation(i) for i in invitations_result.all()],
    }


@router.post("/teams", status_code=201)
async def create_team(
    payload: TeamNameRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with db.begin():
        if await instance_role(user.id, db) != "admin":
            raise HTTPException(status_code=403, detail="Your role cannot do this")

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

        if team.name == DEFAULT_TEAM_NAME:
            raise HTTPException(
                status_code=409,
                detail="Das Standard-Team lässt sich nicht umbenennen.",
            )

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

        if team.name == DEFAULT_TEAM_NAME:
            raise HTTPException(
                status_code=409, detail="Das Standard-Team lässt sich nicht löschen."
            )

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
        await _check_role_for_team(membership.team_id, payload.role, db)
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


async def _invitation_of_team(
    invitation_id: int, team_id: int, db: AsyncSession
) -> TeamInvitation:
    invitation = await db.get(TeamInvitation, invitation_id)

    # another team's invitation looks like a missing one
    if invitation is None or invitation.team_id != team_id:
        raise HTTPException(status_code=404, detail="Invitation not found")

    return invitation


@router.post("/team/invitations", status_code=201)
async def invite_member(
    payload: InviteRequest,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        await _check_role_for_team(membership.team_id, payload.role, db)

        member = await db.exec(
            select(TeamMembership.id)
            .join(User, User.id == TeamMembership.user_id)
            .where(TeamMembership.team_id == membership.team_id)
            .where(func.lower(User.email) == payload.email)
        )
        if member.first() is not None:
            raise HTTPException(
                status_code=409,
                detail=f"{payload.email} ist schon Mitglied des Teams.",
            )

        existing = await db.exec(
            select(TeamInvitation.id)
            .where(TeamInvitation.team_id == membership.team_id)
            .where(TeamInvitation.email == payload.email)
        )
        if existing.first() is not None:
            raise HTTPException(
                status_code=409, detail=f"{payload.email} ist schon eingeladen."
            )

        invitation = TeamInvitation(
            team_id=membership.team_id,
            email=payload.email,
            role=payload.role,
            invited_by=user.id,
        )
        db.add(invitation)
        await db.flush()

    await enqueue_team_invitation(invitation.id)

    return _invitation(invitation)


@router.patch("/team/invitations/{invitation_id}", status_code=204)
async def change_invitation_role(
    invitation_id: int,
    payload: RoleRequest,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        await _check_role_for_team(membership.team_id, payload.role, db)
        invitation = await _invitation_of_team(invitation_id, membership.team_id, db)
        invitation.role = payload.role
        db.add(invitation)


@router.delete("/team/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    invitation_id: int,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        invitation = await _invitation_of_team(invitation_id, membership.team_id, db)
        await db.delete(invitation)


def _domain(entry: TeamDomain, added_by: str) -> dict:
    return {
        "id": entry.id,
        "domain": entry.domain,
        "added_by": added_by,
        "added_at": entry.created_at,
    }


@router.get("/team/domains")
async def get_domains(
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.exec(
        select(TeamDomain, User.name)
        .join(User, User.id == TeamDomain.added_by)
        .where(TeamDomain.team_id == membership.team_id)
        .order_by(TeamDomain.id)
    )

    return {
        # the mailbox Outlook forwards to, the same for every team
        "report_address": os.getenv("POP3_USERNAME", ""),
        "domains": [_domain(entry, name) for entry, name in result.all()],
    }


@router.post("/team/domains", status_code=201)
async def add_domain(
    payload: DomainRequest,
    user: User = Depends(get_current_user),
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    try:
        domain = normalize_domain(payload.domain)
    except DomainError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    async with db.begin():
        result = await db.exec(select(TeamDomain))

        # a subdomain or a parent belongs to the same company, so it counts
        for entry in result.all():
            if not (
                covered_by(domain, entry.domain) or covered_by(entry.domain, domain)
            ):
                continue

            if entry.team_id != membership.team_id:
                raise HTTPException(
                    status_code=409,
                    detail="Die Domain gehört schon zu einem anderen Team.",
                )

            if entry.domain == domain:
                raise HTTPException(
                    status_code=409, detail="Die Domain ist schon eingetragen."
                )

        entry = TeamDomain(team_id=membership.team_id, domain=domain, added_by=user.id)
        db.add(entry)
        await db.flush()

    return _domain(entry, user.name)


@router.delete("/team/domains/{domain_id}", status_code=204)
async def remove_domain(
    domain_id: int,
    membership: TeamMembership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    require_role(membership, "admin")

    async with db.begin():
        entry = await db.get(TeamDomain, domain_id)

        if entry is None or entry.team_id != membership.team_id:
            raise HTTPException(status_code=404, detail="Domain not found")

        await db.delete(entry)
