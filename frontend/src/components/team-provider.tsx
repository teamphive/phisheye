/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { selectTeam } from "@/lib/session"
import { teams, type Team } from "@/mocks/session"

type TeamProviderState = {
  teams: Team[]
  activeTeam: Team
  /** The team being switched to while the request runs, otherwise null. */
  pendingTeamId: string | null
  switchTeam: (teamId: string) => Promise<void>
}

const TeamProviderContext = React.createContext<TeamProviderState | undefined>(
  undefined
)

/**
 * Holds the team the backend treats as active. The interface only follows once
 * the server has accepted the switch, so it never shows a team whose data the
 * API would not hand out.
 */
export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = React.useState(teams[0].id)
  const [pendingTeamId, setPendingTeamId] = React.useState<string | null>(null)

  const activeTeam = teams.find((team) => team.id === activeId) ?? teams[0]

  const switchTeam = React.useCallback(
    async (teamId: string) => {
      if (teamId === activeId) return

      setPendingTeamId(teamId)

      try {
        await selectTeam(teamId)
        setActiveId(teamId)
      } finally {
        setPendingTeamId(null)
      }
    },
    [activeId]
  )

  const value = React.useMemo(
    () => ({ teams, activeTeam, pendingTeamId, switchTeam }),
    [activeTeam, pendingTeamId, switchTeam]
  )

  return (
    <TeamProviderContext.Provider value={value}>
      {children}
    </TeamProviderContext.Provider>
  )
}

export function useTeams() {
  const context = React.useContext(TeamProviderContext)

  if (context === undefined) {
    throw new Error("useTeams must be used within a TeamProvider")
  }

  return context
}
