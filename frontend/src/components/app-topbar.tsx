import { Link } from "react-router"
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react"

import { NotificationsMenu } from "@/components/notifications-menu"
import { SearchCommand } from "@/components/search-command"
import { useSession } from "@/components/session-provider"
import { TeamSwitcher } from "@/components/team-switcher"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { teamRoleLabel } from "@/lib/instance"
import { authEnabled, logout } from "@/lib/keycloak"

export function AppTopbar() {
  const { user, activeTeam } = useSession()

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/85 px-7 py-2.5 backdrop-blur">
      <SearchCommand />
      <div className="flex-1" />
      <TeamSwitcher />
      <NotificationsMenu />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 hover:bg-muted">
          <Avatar className="size-7">
            <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm leading-tight font-medium">{user.name}</span>
          <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-3 py-2">
              <Avatar className="size-9">
                <AvatarFallback className="bg-muted text-sm font-medium text-foreground">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-medium text-foreground">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {teamRoleLabel(activeTeam)} im Team {activeTeam.name}
                </span>
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link to="/einstellungen" />}>
            <SettingsIcon />
            Einstellungen
          </DropdownMenuItem>
          {authEnabled ? (
            <DropdownMenuItem onClick={() => logout()}>
              <LogOutIcon />
              Abmelden
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
