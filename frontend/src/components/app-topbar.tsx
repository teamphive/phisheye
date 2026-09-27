import { Link } from "react-router"

import { NotificationsMenu } from "@/components/notifications-menu"
import { SearchCommand } from "@/components/search-command"
import { useSession } from "@/components/session-provider"
import { TeamSwitcher } from "@/components/team-switcher"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { roleLabel } from "@/mocks/session"

export function AppTopbar() {
  const { user, activeTeam } = useSession()

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-background/85 px-7 py-2.5 backdrop-blur">
      <SearchCommand />
      <div className="flex-1" />
      <TeamSwitcher />
      <NotificationsMenu />

      <Link
        to="/einstellungen"
        className="ml-1 flex items-center gap-2.5 rounded-md border-l border-border py-1 pr-2 pl-2.5 hover:bg-muted"
      >
        <Avatar className="size-[30px]">
          <AvatarFallback className="bg-primary text-[11.5px] font-semibold text-primary-foreground">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold">{user.name}</span>
          <span className="block font-mono text-[10px] text-faint">
            {roleLabel[activeTeam.role]}
          </span>
        </span>
      </Link>
    </header>
  )
}
