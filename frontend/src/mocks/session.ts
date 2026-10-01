// Placeholder data until the API is wired up. Everything here is invented.

export type TeamRole = "admin" | "analyst" | "audit"

/** The role in the default team, it counts for every team. */
export type InstanceRole = "admin" | "audit"

export type Team = {
  id: string
  name: string
  memberCount: number
  /** In a team entered through the instance role, that role. */
  role: TeamRole
  /** Not a member: the instance role opens the team. */
  viaInstance: boolean
}

export type CurrentUser = {
  name: string
  email: string
  initials: string
  isOperator: boolean
  /** Admin or auditor of the default team, null for everyone else. */
  instanceRole: InstanceRole | null
  /** Only the instance admin creates teams. */
  canCreateTeams: boolean
}

export const roleLabel: Record<TeamRole, string> = {
  admin: "Admin",
  analyst: "Analyst",
  audit: "Audit",
}

export const instanceRoleLabel: Record<InstanceRole, string> = {
  admin: "Instanz-Admin",
  audit: "Instanz-Auditor",
}

export const currentUser: CurrentUser = {
  name: "M. Sandmann",
  email: "m.sandmann@hansa-logistik.de",
  initials: "MS",
  isOperator: true,
  instanceRole: "admin",
  canCreateTeams: true,
}

export const teams: Team[] = [
  {
    id: "itsec",
    name: "IT-Security",
    memberCount: 4,
    role: "admin",
    viaInstance: false,
  },
  {
    id: "soc",
    name: "SOC Bereitschaft",
    memberCount: 3,
    role: "admin",
    viaInstance: false,
  },
  {
    id: "standard",
    name: "Standard-Team",
    memberCount: 2,
    role: "admin",
    viaInstance: false,
  },
  {
    id: "reederei",
    name: "Nordsee-Reederei",
    memberCount: 2,
    role: "admin",
    viaInstance: true,
  },
]

// The placeholder server remembers the active team while the page is open.
let activeTeamId: string | null = teams[0]?.id ?? null

export function mockActiveTeamId() {
  return teams.some((team) => team.id === activeTeamId)
    ? activeTeamId
    : (teams[0]?.id ?? null)
}

export function mockSelectTeam(teamId: string) {
  activeTeamId = teamId
}

/** A one time code app, as Keycloak lists it under the user's credentials. */
export type Authenticator = {
  id: string
  /** The name given while setting it up, null if left empty. */
  label: string | null
  createdAt: string
}

export type RecoveryCodes = {
  id: string
  /** Null when Keycloak does not say how many are used. */
  used: number | null
  total: number | null
  createdAt: string
}

/** A browser Keycloak has sessions for, signing it out ends all of them. */
export type Device = {
  sessionIds: string[]
  browser: string
  os: string
  ipAddress: string
  lastAccess: string
  current: boolean
  mobile: boolean
}

/** What Keycloak knows about the signed in user's login, nothing of it in the app database. */
export type AccountSecurity = {
  /** When the current password was set, null without one. */
  passwordChangedAt: string | null
  authenticators: Authenticator[]
  recoveryCodes: RecoveryCodes | null
  devices: Device[]
}

// The placeholder Keycloak forgets signed out devices on the next reload.
let devices: Device[] = [
  {
    sessionIds: ["win"],
    browser: "Chrome 140",
    os: "Windows",
    ipAddress: "192.168.14.62",
    lastAccess: "2026-09-10T07:55:00Z",
    current: true,
    mobile: false,
  },
  {
    sessionIds: ["mac"],
    browser: "Firefox 143",
    os: "macOS",
    ipAddress: "192.168.14.90",
    lastAccess: "2026-09-09T15:42:00Z",
    current: false,
    mobile: false,
  },
  {
    sessionIds: ["ios"],
    browser: "Mobile Safari 18",
    os: "iOS",
    ipAddress: "84.62.11.7",
    lastAccess: "2026-08-29T09:10:00Z",
    current: false,
    mobile: true,
  },
]

export function mockAccountSecurity(): AccountSecurity {
  return {
    passwordChangedAt: "2026-06-04T09:12:00Z",
    authenticators: [
      { id: "otp-1", label: "iPhone", createdAt: "2026-06-12T14:30:00Z" },
    ],
    recoveryCodes: {
      id: "codes",
      used: 2,
      total: 12,
      createdAt: "2026-06-12T14:34:00Z",
    },
    devices: devices.map((device) => ({ ...device })),
  }
}

export function mockSignOut(sessionIds: string[]) {
  devices = devices.filter(
    (device) => !device.sessionIds.some((id) => sessionIds.includes(id))
  )
}

export function mockSignOutOthers() {
  devices = devices.filter((device) => device.current)
}
