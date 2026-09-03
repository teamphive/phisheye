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

export const currentUser: CurrentUser = {
  name: "M. Sandmann",
  email: "m.sandmann@hansa-logistik.de",
  initials: "MS",
  isOperator: true,
}

export const teams: Team[] = [
  { id: "itsec", name: "IT-Security", memberCount: 5, role: "admin" },
  { id: "soc", name: "SOC Bereitschaft", memberCount: 3, role: "admin" },
]

export const unreadNotifications = 3
