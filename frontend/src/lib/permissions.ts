import type { CurrentUser, TeamRole } from "@/mocks/session"

/**
 * What the interface offers in the active team. It only hides controls, the
 * backend enforces every one of these rules itself.
 */
export type Permissions = {
  /** Upload mails, decide verdicts, cancel or restart an analysis. */
  analyze: boolean
  /** Delete analyses for the whole team. */
  deleteAnalyses: boolean
  /** Invite, change roles, remove members, rename or delete the team, domains. */
  manageTeam: boolean
  /** The system-wide monitoring, independent of any team role. */
  monitor: boolean
  /** New teams, only for the instance admin, independent of the active team. */
  createTeams: boolean
}

export function permissionsOf(
  role: TeamRole,
  user: Pick<CurrentUser, "isOperator" | "canCreateTeams">
): Permissions {
  return {
    analyze: role !== "audit",
    deleteAnalyses: role === "admin",
    manageTeam: role === "admin",
    monitor: user.isOperator,
    createTeams: user.canCreateTeams,
  }
}
