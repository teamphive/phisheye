import { apiEnabled, apiFetch, mockLatency } from "@/lib/api"
import { authEnabled, keycloak } from "@/lib/keycloak"
import { initialsOf } from "@/lib/format"
import {
  currentUser,
  mockActiveTeamId,
  mockSelectTeam,
  teams as placeholderTeams,
  type CurrentUser,
  type Team,
} from "@/mocks/session"

export type Session = {
  user: CurrentUser
  teams: Team[]
  /** Null only for someone who does not belong to any team yet. */
  activeTeamId: string | null
}

/**
 * GET /me after the switch to camelCase. A backend from before the instance
 * roles sends neither instanceRole, canCreateTeams nor viaInstance.
 */
type MeResponse = Omit<CurrentUser, "instanceRole" | "canCreateTeams"> & {
  instanceRole?: CurrentUser["instanceRole"]
  canCreateTeams?: boolean
  teams: (Omit<Team, "id" | "viaInstance"> & {
    id: string | number
    viaInstance?: boolean
  })[]
  activeTeamId?: string | number | null
}

let cached: CurrentUser | undefined

/**
 * The signed in user as far as the token tells, or the placeholder without
 * Keycloak. Only a stand-in while no backend is configured: name and address
 * come from the token, the operator flag lives in the app database.
 */
export function sessionUser(): CurrentUser {
  if (cached) return cached

  const claims = keycloak.tokenParsed
  if (!authEnabled || !claims) return currentUser

  const name: string = claims.name ?? claims.preferred_username ?? "Unbekannt"

  cached = {
    ...currentUser,
    name,
    email: claims.email ?? "",
    initials: initialsOf(name),
  }

  return cached
}

/** The signed in user, the teams with the role in each and the active one. */
export async function fetchSession(): Promise<Session> {
  if (!apiEnabled) {
    await mockLatency(300)
    return {
      user: { ...sessionUser() },
      // Copies, the placeholder server changes its own entries in place
      teams: placeholderTeams.map((team) => ({ ...team })),
      activeTeamId: mockActiveTeamId(),
    }
  }

  const me = await apiFetch<MeResponse>("/me")

  // Whether the backend hands out numbers or UUIDs, the interface compares
  // ids as strings.
  const teams = me.teams.map((team) => ({
    ...team,
    id: String(team.id),
    viaInstance: team.viaInstance ?? false,
  }))
  const activeId = me.activeTeamId == null ? null : String(me.activeTeamId)

  return {
    user: {
      name: me.name,
      email: me.email,
      initials: me.initials,
      isOperator: me.isOperator,
      instanceRole: me.instanceRole ?? null,
      canCreateTeams: me.canCreateTeams ?? false,
    },
    teams,
    // Without an answer from the server the first team stands in
    activeTeamId:
      (teams.find((team) => team.id === activeId) ?? teams[0])?.id ?? null,
  }
}

/**
 * Makes a team the active one on the server. The team context lives in the
 * session, not in the address, so every later call answers for this team.
 */
export async function selectTeam(teamId: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockSelectTeam(teamId)
  }

  await apiFetch<void>("/me/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team_id: teamId }),
  })
}

/** The display name, address and roles stay as they are. */
export async function updateProfile(name: string) {
  if (!apiEnabled) {
    await mockLatency()
    Object.assign(sessionUser(), { name, initials: initialsOf(name) })
    return
  }

  await apiFetch<unknown>("/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
}
