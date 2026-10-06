import { useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CreateTeamDialog } from "@/components/create-team-dialog"
import { useSession } from "@/components/session-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/api"
import { instanceRoleLabel, roleLabel, type Team } from "@/mocks/session"

export function TeamSwitcher() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const {
    user,
    teams,
    activeTeam: active,
    permissions,
    pendingTeamId,
    switchTeam,
    refresh,
  } = useSession()
  const [createOpen, setCreateOpen] = useState(false)

  const ownTeams = teams.filter((team) => !team.viaInstance)
  // An instance member sees every team, the name finds one faster than the age
  const otherTeams = teams
    .filter((team) => team.viaInstance)
    .sort((a, b) => a.name.localeCompare(b.name, "de"))

  async function choose(teamId: string) {
    if (teamId === active.id) return

    try {
      await switchTeam(teamId)
    } catch (error) {
      toast.error("Teamwechsel fehlgeschlagen", {
        description: errorMessage(error),
      })
      return
    }

    leaveOtherTeamsAnalysis()
  }

  // An analysis belongs to exactly one team, the new one would answer 404.
  function leaveOtherTeamsAnalysis() {
    if (pathname.startsWith("/analysen/") && pathname !== "/analysen/neu") {
      navigate("/analysen")
    }
  }

  async function created() {
    await refresh()
    leaveOtherTeamsAnalysis()
  }

  function teamItem(team: Team) {
    return (
      <DropdownMenuItem
        key={team.id}
        onClick={() => choose(team.id)}
        className="gap-3"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {team.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {team.memberCount} Mitglieder,{" "}
            {team.viaInstance
              ? "du bist kein Mitglied"
              : `deine Rolle: ${roleLabel[team.role]}`}
          </span>
        </span>
        {team.id === active.id ? (
          <CheckIcon className="size-3.5 shrink-0" />
        ) : null}
      </DropdownMenuItem>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pendingTeamId !== null}
          className="flex max-w-[220px] items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium shadow-xs hover:bg-muted disabled:opacity-70 dark:shadow-none"
        >
          <span className="truncate">{active.name}</span>
          {pendingTeamId !== null ? (
            <Spinner className="size-3.5 shrink-0 text-faint" />
          ) : (
            <ChevronDownIcon className="size-3.5 shrink-0 text-faint" />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[300px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {otherTeams.length > 0 ? "Deine Teams" : "Team wechseln"}
            </DropdownMenuLabel>
            {ownTeams.map(teamItem)}
          </DropdownMenuGroup>

          {otherTeams.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {user.instanceRole
                    ? `Weitere Teams · ${instanceRoleLabel[user.instanceRole]}`
                    : "Weitere Teams"}
                </DropdownMenuLabel>
                {otherTeams.map(teamItem)}
              </DropdownMenuGroup>
            </>
          ) : null}

          {permissions.createTeams ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                Neues Team erstellen
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Lives outside the menu so closing the menu does not unmount it. */}
      {permissions.createTeams ? (
        <CreateTeamDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={created}
        />
      ) : null}
    </>
  )
}
