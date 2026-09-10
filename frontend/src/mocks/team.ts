// Placeholder data until the team endpoints exist. Everything here is invented.
// Times are ISO 8601 in UTC, exactly as the API will deliver them.

import type { TeamRole } from "@/mocks/session"

export type Member = {
  id: string
  name: string
  email: string
  initials: string
  role: TeamRole
  twoFactorEnabled: boolean
  analysisCount: number
  isSelf: boolean
}

export type Invitation = {
  id: string
  email: string
  role: TeamRole
  invitedAt: string
}

export const members: Member[] = [
  {
    id: "m-sandmann",
    name: "M. Sandmann",
    email: "m.sandmann@hansa-logistik.de",
    initials: "MS",
    role: "admin",
    twoFactorEnabled: true,
    analysisCount: 42,
    isSelf: true,
  },
  {
    id: "l-brinkmann",
    name: "L. Brinkmann",
    email: "l.brinkmann@hansa-logistik.de",
    initials: "LB",
    role: "admin",
    twoFactorEnabled: true,
    analysisCount: 67,
    isSelf: false,
  },
  {
    id: "t-oezdemir",
    name: "T. Özdemir",
    email: "t.oezdemir@hansa-logistik.de",
    initials: "TÖ",
    role: "analyst",
    twoFactorEnabled: false,
    analysisCount: 19,
    isSelf: false,
  },
  {
    id: "r-kowalski",
    name: "R. Kowalski",
    email: "r.kowalski@hansa-logistik.de",
    initials: "RK",
    role: "analyst",
    twoFactorEnabled: true,
    analysisCount: 0,
    isSelf: false,
  },
]

export const invitations: Invitation[] = [
  {
    id: "i-hoffmann",
    email: "a.hoffmann@hansa-logistik.de",
    role: "analyst",
    invitedAt: "2026-08-27T08:30:00Z",
  },
]

/** Shown in the invite dialog, so the choice explains itself. */
export const roleDescription: Record<TeamRole, string> = {
  analyst: "analysiert und sieht alle Analysen des Teams",
  admin: "verwaltet zusätzlich Mitglieder und Einstellungen",
  audit: "darf ausschließlich lesen",
}
