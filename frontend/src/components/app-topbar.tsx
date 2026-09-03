import { Link } from "react-router"

import { NotificationsMenu } from "@/components/notifications-menu"
import { SearchCommand } from "@/components/search-command"
import { TeamSwitcher } from "@/components/team-switcher"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { currentUser } from "@/mocks/session"

export function AppTopbar() {
  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 flex items-center gap-4 border-b px-7 py-2.5 backdrop-blur">
      <SearchCommand />
      <div className="flex-1" />
      <TeamSwitcher />
      <NotificationsMenu />

      <Link
        to="/einstellungen"
        className="border-border hover:bg-muted ml-1 flex items-center gap-2.5 rounded-md border-l py-1 pr-2 pl-2.5"
      >
        <Avatar className="size-[30px]">
          <AvatarFallback className="bg-primary text-primary-foreground text-[11.5px] font-semibold">
            {currentUser.initials}
          </AvatarFallback>
        </Avatar>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold">{currentUser.name}</span>
          <span className="text-faint font-mono block text-[10px]">Admin</span>
        </span>
      </Link>
    </header>
  )
}
