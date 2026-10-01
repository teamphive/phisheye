import {
  instanceRoleLabel,
  roleLabel,
  type Team,
  type TeamRole,
} from "@/mocks/session"

/**
 * The instance team. The backend knows it by this fixed name as well
 * (DEFAULT_TEAM_NAME in backend/app/constants.py), it cannot be renamed.
 */
export const DEFAULT_TEAM_NAME = "Standard-Team"

/** Its admins and auditors count for every team, it has no analysts. */
export function isDefaultTeam(team: Pick<Team, "name">) {
  return team.name === DEFAULT_TEAM_NAME
}

/**
 * The roles a member or an invitation can have in this team, the first one
 * is preselected for an invitation. In the default team that is the one that
 * only reads, since both roles open every team.
 */
export function rolesFor(team: Pick<Team, "name">): TeamRole[] {
  return isDefaultTeam(team)
    ? ["audit", "admin"]
    : ["analyst", "admin", "audit"]
}

/** The role in a team, named as the instance role where it comes from there. */
export function teamRoleLabel(team: Pick<Team, "role" | "viaInstance">) {
  if (!team.viaInstance) return roleLabel[team.role]

  return instanceRoleLabel[team.role === "admin" ? "admin" : "audit"]
}
