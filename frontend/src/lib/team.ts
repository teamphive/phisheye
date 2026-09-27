import { apiEnabled, apiFetch, mockLatency } from "@/lib/api"
import { sessionUser } from "@/lib/session"
import type { Team, TeamRole } from "@/mocks/session"
import {
  mockAddReportDomain,
  mockChangeInvitationRole,
  mockChangeMemberRole,
  mockCreateTeam,
  mockDeleteTeam,
  mockInvite,
  mockLeaveTeam,
  mockRemoveMember,
  mockRemoveReportDomain,
  mockRenameTeam,
  mockReportSettings,
  mockRevokeInvitation,
  mockTeam,
  type Invitation,
  type ReportDomain,
  type ReportSettings,
  type TeamRoster,
} from "@/mocks/team"

// The backend knows the team from the session, the id only tells the
// placeholder data which team is meant.

/** Members and open invitations of the active team. */
export async function fetchTeam(teamId: string) {
  if (!apiEnabled) {
    await mockLatency(500)
    return mockTeam(teamId)
  }

  return apiFetch<TeamRoster>("/team")
}

/** Where Outlook forwards reports, and which domains land in the active team. */
export async function fetchReportSettings(teamId: string) {
  if (!apiEnabled) {
    await mockLatency(500)
    return mockReportSettings(teamId)
  }

  return apiFetch<ReportSettings>("/team/domains")
}

/** Answers 409 if another team already has the domain or overlaps with it. */
export async function addReportDomain(teamId: string, domain: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockAddReportDomain(teamId, domain, sessionUser().name)
  }

  return apiFetch<ReportDomain>("/team/domains", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  })
}

export async function removeReportDomain(teamId: string, id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockRemoveReportDomain(teamId, id)
  }

  await apiFetch<void>(`/team/domains/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

/** Answers 409 if the address is already a member or invited. */
export async function inviteMember(
  teamId: string,
  email: string,
  role: TeamRole
) {
  if (!apiEnabled) {
    await mockLatency()
    return mockInvite(teamId, email, role)
  }

  return apiFetch<Invitation>(
    "/team/invitations",
    json("POST", { email, role })
  )
}

/** The role only takes effect once the invitation is accepted. */
export async function changeInvitationRole(
  teamId: string,
  id: string,
  role: TeamRole
) {
  if (!apiEnabled) {
    await mockLatency()
    return mockChangeInvitationRole(teamId, id, role)
  }

  await apiFetch<unknown>(
    `/team/invitations/${encodeURIComponent(id)}`,
    json("PATCH", { role })
  )
}

export async function revokeInvitation(teamId: string, id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockRevokeInvitation(teamId, id)
  }

  await apiFetch<void>(`/team/invitations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

/** Answers 409 when the last admin would step down. */
export async function changeMemberRole(
  teamId: string,
  id: string,
  role: TeamRole
) {
  if (!apiEnabled) {
    await mockLatency()
    return mockChangeMemberRole(teamId, id, role)
  }

  await apiFetch<unknown>(
    `/team/members/${encodeURIComponent(id)}`,
    json("PATCH", { role })
  )
}

export async function removeMember(teamId: string, id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockRemoveMember(teamId, id)
  }

  await apiFetch<void>(`/team/members/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

/**
 * Leaving is removing one's own membership. Answers 409 for the last admin
 * and for the last team the user belongs to.
 */
export async function leaveTeam(teamId: string, selfId: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockLeaveTeam(teamId, selfId)
  }

  await apiFetch<void>(`/team/members/${encodeURIComponent(selfId)}`, {
    method: "DELETE",
  })
}

/** The creator becomes the new team's admin. */
export async function createTeam(name: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockCreateTeam(name, sessionUser())
  }

  const team = await apiFetch<Omit<Team, "id"> & { id: string | number }>(
    "/teams",
    json("POST", { name })
  )
  return { ...team, id: String(team.id) }
}

export async function renameTeam(teamId: string, name: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockRenameTeam(teamId, name)
  }

  await apiFetch<unknown>("/team", json("PATCH", { name }))
}

/** Soft delete, the backend removes it for good after 10 days. */
export async function deleteTeam(teamId: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockDeleteTeam(teamId)
  }

  await apiFetch<void>("/team", { method: "DELETE" })
}
