// Placeholder data until the API is wired up. Everything here is invented.

export type TeamRole = "admin" | "analyst" | "audit"

export type Team = {
  id: string
  name: string
  memberCount: number
  role: TeamRole
}

export type CurrentUser = {
  name: string
  email: string
  initials: string
  isOperator: boolean
}

export const roleLabel: Record<TeamRole, string> = {
  admin: "Admin",
  analyst: "Analyst",
  audit: "Audit",
}

export const currentUser: CurrentUser = {
  name: "M. Sandmann",
  email: "m.sandmann@hansa-logistik.de",
  initials: "MS",
  isOperator: true,
}

export const teams: Team[] = [
  { id: "itsec", name: "IT-Security", memberCount: 4, role: "admin" },
  { id: "soc", name: "SOC Bereitschaft", memberCount: 3, role: "admin" },
]

export type Security = {
  passwordChangedAt: string
  twoFactorEnabled: boolean
  twoFactorMethod: string
  twoFactorSetUpAt: string
  backupCodesTotal: number
  backupCodesUnused: number
  sessionCount: number
  lastSessionAgent: string
  lastSessionAt: string
}

export const security: Security = {
  passwordChangedAt: "2026-06-04T09:12:00Z",
  twoFactorEnabled: true,
  twoFactorMethod: "Authenticator-App",
  twoFactorSetUpAt: "2026-06-12T14:30:00Z",
  backupCodesTotal: 8,
  backupCodesUnused: 6,
  sessionCount: 3,
  lastSessionAgent: "Chrome auf Windows",
  lastSessionAt: "2026-09-03T08:20:00Z",
}

export type DeviceSession = {
  id: string
  agent: string
  location: string
  ip: string
  lastActiveAt: string
  current: boolean
}

export const sessions: DeviceSession[] = [
  {
    id: "win",
    agent: "Chrome auf Windows",
    location: "Bremen",
    ip: "192.168.14.62",
    lastActiveAt: "2026-09-10T07:55:00Z",
    current: true,
  },
  {
    id: "mac",
    agent: "Firefox auf macOS",
    location: "Bremen",
    ip: "192.168.14.90",
    lastActiveAt: "2026-09-09T15:42:00Z",
    current: false,
  },
  {
    id: "ios",
    agent: "Safari auf iPhone",
    location: "Unbekannter Ort",
    ip: "84.62.11.7",
    lastActiveAt: "2026-08-29T09:10:00Z",
    current: false,
  },
]

/** Freshly generated codes, shown once and never again. */
export const backupCodes = [
  "P7QK-2XMB",
  "4RJD-9TLV",
  "8CWN-5FZA",
  "1HYE-6BQR",
  "3MKT-0GUP",
  "9VSD-7NXC",
  "2LFB-4WHJ",
  "6ZQA-1RKE",
]
