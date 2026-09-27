// Placeholder data until the team endpoints exist. Everything here is invented.
// Times are ISO 8601 in UTC, exactly as the API will deliver them.

import { ApiError } from "@/lib/api"
import { coveredBy } from "@/lib/domains"
import {
  teams,
  type CurrentUser,
  type Team,
  type TeamRole,
} from "@/mocks/session"

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

export type TeamRoster = {
  members: Member[]
  invitations: Invitation[]
}

// Changed in place, so every change survives a team switch.
const rosterByTeam: Record<string, TeamRoster> = {
  itsec: {
    members: [
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
    ],
    invitations: [
      {
        id: "i-hoffmann",
        email: "a.hoffmann@hansa-logistik.de",
        role: "analyst",
        invitedAt: "2026-08-27T08:30:00Z",
      },
    ],
  },
  soc: {
    members: [
      {
        id: "m-sandmann",
        name: "M. Sandmann",
        email: "m.sandmann@hansa-logistik.de",
        initials: "MS",
        role: "admin",
        twoFactorEnabled: true,
        analysisCount: 1,
        isSelf: true,
      },
      {
        id: "l-brinkmann",
        name: "L. Brinkmann",
        email: "l.brinkmann@hansa-logistik.de",
        initials: "LB",
        role: "analyst",
        twoFactorEnabled: true,
        analysisCount: 1,
        isSelf: false,
      },
      {
        id: "j-albers",
        name: "J. Albers",
        email: "j.albers@hansa-logistik.de",
        initials: "JA",
        role: "audit",
        twoFactorEnabled: false,
        analysisCount: 0,
        isSelf: false,
      },
    ],
    invitations: [],
  },
}

export function mockTeam(teamId: string): TeamRoster {
  const roster = rosterOf(teamId)
  return { members: [...roster.members], invitations: [...roster.invitations] }
}

function rosterOf(teamId: string) {
  rosterByTeam[teamId] ??= { members: [], invitations: [] }
  return rosterByTeam[teamId]
}

function adminCount(roster: TeamRoster) {
  return roster.members.filter((member) => member.role === "admin").length
}

function syncMemberCount(teamId: string) {
  const team = teams.find((entry) => entry.id === teamId)
  if (team) team.memberCount = rosterOf(teamId).members.length
}

export function mockInvite(
  teamId: string,
  email: string,
  role: TeamRole
): Invitation {
  const roster = rosterOf(teamId)
  const address = email.toLowerCase()

  if (roster.members.some((member) => member.email === address)) {
    throw new ApiError(409, `${address} ist schon Mitglied des Teams.`)
  }
  if (roster.invitations.some((entry) => entry.email === address)) {
    throw new ApiError(409, `${address} ist schon eingeladen.`)
  }

  const invitation: Invitation = {
    id: `i-${Date.now()}`,
    email: address,
    role,
    invitedAt: new Date().toISOString(),
  }
  roster.invitations = [...roster.invitations, invitation]

  return invitation
}

export function mockChangeInvitationRole(
  teamId: string,
  id: string,
  role: TeamRole
) {
  const roster = rosterOf(teamId)
  roster.invitations = roster.invitations.map((entry) =>
    entry.id === id ? { ...entry, role } : entry
  )
}

export function mockRevokeInvitation(teamId: string, id: string) {
  const roster = rosterOf(teamId)
  roster.invitations = roster.invitations.filter((entry) => entry.id !== id)
}

export function mockChangeMemberRole(
  teamId: string,
  id: string,
  role: TeamRole
) {
  const roster = rosterOf(teamId)
  const member = roster.members.find((entry) => entry.id === id)

  if (
    member?.role === "admin" &&
    role !== "admin" &&
    adminCount(roster) === 1
  ) {
    throw new ApiError(409, "Das Team braucht mindestens einen Admin.")
  }

  roster.members = roster.members.map((entry) =>
    entry.id === id ? { ...entry, role } : entry
  )

  // The signed in user's role is part of the session as well
  const team = teams.find((entry) => entry.id === teamId)
  if (team && member?.isSelf) team.role = role
}

export function mockRemoveMember(teamId: string, id: string) {
  const roster = rosterOf(teamId)
  const member = roster.members.find((entry) => entry.id === id)

  if (member?.role === "admin" && adminCount(roster) === 1) {
    throw new ApiError(409, "Das Team braucht mindestens einen Admin.")
  }

  roster.members = roster.members.filter((entry) => entry.id !== id)
  syncMemberCount(teamId)
}

/** Leaving is removing oneself, with the rule about the last team on top. */
export function mockLeaveTeam(teamId: string, id: string) {
  if (teams.length === 1) {
    throw new ApiError(
      409,
      "Das ist dein letztes Team. Lege erst ein anderes an oder lass dich einladen."
    )
  }

  const self = rosterOf(teamId).members.find((entry) => entry.id === id)
  if (self?.role === "admin" && adminCount(rosterOf(teamId)) === 1) {
    throw new ApiError(
      409,
      "Du bist der letzte Admin. Gib die Rolle erst an jemand anderen ab."
    )
  }

  mockRemoveMember(teamId, id)
  dropTeam(teamId)
}

export function mockCreateTeam(name: string, self: CurrentUser): Team {
  const team: Team = {
    id: `t-${Date.now()}`,
    name,
    memberCount: 1,
    role: "admin",
  }

  teams.push(team)
  rosterByTeam[team.id] = {
    members: [
      {
        id: `m-${Date.now()}`,
        name: self.name,
        email: self.email,
        initials: self.initials,
        role: "admin",
        twoFactorEnabled: true,
        analysisCount: 0,
        isSelf: true,
      },
    ],
    invitations: [],
  }

  return team
}

export function mockRenameTeam(teamId: string, name: string) {
  const team = teams.find((entry) => entry.id === teamId)
  if (team) team.name = name
}

export function mockDeleteTeam(teamId: string) {
  delete rosterByTeam[teamId]
  delete domainsByTeam[teamId]
  dropTeam(teamId)
}

function dropTeam(teamId: string) {
  const index = teams.findIndex((entry) => entry.id === teamId)
  if (index >= 0) teams.splice(index, 1)
}

/** Shown in the invite dialog, so the choice explains itself. */
export const roleDescription: Record<TeamRole, string> = {
  analyst: "analysiert und sieht alle Analysen des Teams",
  admin: "verwaltet zusätzlich Mitglieder und Einstellungen",
  audit: "darf ausschließlich lesen",
}

/** Reported mails from this domain and its subdomains go to the team. */
export type ReportDomain = {
  id: string
  domain: string
  addedBy: string
  addedAt: string
}

export type ReportSettings = {
  /** The mailbox Outlook forwards reports to, the same for every team. */
  reportAddress: string
  domains: ReportDomain[]
}

// Changed in place, so added and removed domains survive a team switch.
const domainsByTeam: Record<string, ReportDomain[]> = {
  itsec: [
    {
      id: "d-hansa-de",
      domain: "hansa-logistik.de",
      addedBy: "M. Sandmann",
      addedAt: "2026-08-20T09:14:00Z",
    },
    {
      id: "d-hansa-com",
      domain: "hansa-logistik.com",
      addedBy: "L. Brinkmann",
      addedAt: "2026-09-01T13:02:00Z",
    },
  ],
  soc: [],
}

/** Taken by teams the signed in user is not part of. */
const foreignDomains = ["nordsee-reederei.de", "werft.kuestenbau.de"]

/** Public mail providers belong to no company, the API turns them down. */
const freemailDomains = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "gmx.de",
  "web.de",
  "t-online.de",
]

export function mockReportSettings(teamId: string): ReportSettings {
  return {
    reportAddress: "melden@phisheye.example",
    domains: [...(domainsByTeam[teamId] ?? [])],
  }
}

export function mockAddReportDomain(
  teamId: string,
  domain: string,
  addedBy: string
) {
  if (freemailDomains.some((entry) => coveredBy(domain, entry))) {
    throw new ApiError(
      422,
      "Öffentliche Mail-Anbieter lassen sich nicht eintragen, sie gehören zu keiner Firma."
    )
  }

  const taken = [
    ...foreignDomains,
    ...Object.entries(domainsByTeam)
      .filter(([id]) => id !== teamId)
      .flatMap(([, entries]) => entries.map((entry) => entry.domain)),
  ]

  // Subdomains count, so an overlap in either direction is a conflict.
  if (
    taken.some((entry) => coveredBy(domain, entry) || coveredBy(entry, domain))
  ) {
    throw new ApiError(409, "Die Domain gehört schon zu einem anderen Team.")
  }

  const entry: ReportDomain = {
    id: `d-${Date.now()}`,
    domain,
    addedBy,
    addedAt: new Date().toISOString(),
  }
  domainsByTeam[teamId] = [...(domainsByTeam[teamId] ?? []), entry]

  return entry
}

export function mockRemoveReportDomain(teamId: string, id: string) {
  domainsByTeam[teamId] = (domainsByTeam[teamId] ?? []).filter(
    (entry) => entry.id !== id
  )
}
