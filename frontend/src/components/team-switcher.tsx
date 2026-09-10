import { useState } from "react"
import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react"

import { CreateTeamDialog } from "@/components/create-team-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initialsOf } from "@/lib/format"
import { roleLabel, teams } from "@/mocks/session"

export function TeamSwitcher() {
  const [activeId, setActiveId] = useState(teams[0].id)
  const [createOpen, setCreateOpen] = useState(false)
  const active = teams.find((team) => team.id === activeId) ?? teams[0]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex max-w-[220px] items-center gap-2 rounded-md border border-border bg-card py-1 pr-2 pl-1.5 text-sm font-semibold hover:bg-muted">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-accent font-mono text-[10px] font-semibold text-accent-foreground">
            {initialsOf(active.name)}
          </span>
          <span className="truncate">{active.name}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-faint" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[300px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] tracking-[0.1em] text-faint uppercase">
              Team wechseln
            </DropdownMenuLabel>

            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => setActiveId(team.id)}
                className="gap-3"
              >
                <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-accent font-mono text-[10px] font-semibold text-accent-foreground">
                  {initialsOf(team.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {team.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-faint">
                    {team.memberCount} Mitglieder · deine Rolle:{" "}
                    {roleLabel[team.role]}
                  </span>
                </span>
                {team.id === active.id ? (
                  <CheckIcon className="size-3.5 shrink-0 text-primary" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="font-semibold text-primary"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon className="size-4" />
            Neues Team erstellen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Lives outside the menu so closing the menu does not unmount it. */}
      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
