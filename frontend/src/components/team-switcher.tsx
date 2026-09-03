import { useState } from "react"
import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { teams } from "@/mocks/session"

const roleLabel: Record<string, string> = {
  admin: "Admin",
  analyst: "Analyst",
  audit: "Audit",
}

function initialsOf(name: string) {
  return name
    .split(/[\s\-_.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
}

export function TeamSwitcher() {
  const [activeId, setActiveId] = useState(teams[0].id)
  const active = teams.find((team) => team.id === activeId) ?? teams[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border-border bg-card hover:bg-muted flex max-w-[220px] items-center gap-2 rounded-md border py-1 pr-2 pl-1.5 text-sm font-semibold">
        <span className="bg-accent text-accent-foreground font-mono grid size-[22px] shrink-0 place-items-center rounded-md text-[10px] font-semibold">
          {initialsOf(active.name)}
        </span>
        <span className="truncate">{active.name}</span>
        <ChevronDownIcon className="text-faint size-3.5 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[300px]">
        <DropdownMenuLabel className="text-faint font-mono text-[10px] tracking-[0.1em] uppercase">
          Team wechseln
        </DropdownMenuLabel>

        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => setActiveId(team.id)}
            className="gap-3"
          >
            <span className="bg-accent text-accent-foreground font-mono grid size-[22px] shrink-0 place-items-center rounded-md text-[10px] font-semibold">
              {initialsOf(team.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">
                {team.name}
              </span>
              <span className="text-faint block truncate text-[11.5px]">
                {team.memberCount} Mitglieder · deine Rolle: {roleLabel[team.role]}
              </span>
            </span>
            {team.id === active.id ? (
              <CheckIcon className="text-primary size-3.5 shrink-0" />
            ) : null}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-primary font-semibold">
          <PlusIcon className="size-4" />
          Neues Team erstellen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
