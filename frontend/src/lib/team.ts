import { apiEnabled, apiFetch, mockLatency } from "@/lib/api"
import { sessionUser } from "@/lib/session"
import {
  mockAddReportDomain,
  mockRemoveReportDomain,
  mockReportSettings,
  mockTeam,
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
