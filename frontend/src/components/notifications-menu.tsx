import { useNavigate } from "react-router"
import { BellIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime } from "@/lib/format"
import { notifications, type NotificationTone } from "@/mocks/notifications"

const toneDot: Record<NotificationTone, string> = {
  phishing: "bg-phishing",
  suspicious: "bg-suspicious",
  clean: "bg-clean",
  info: "bg-primary",
}

const latest = notifications.slice(0, 3)
const unreadCount = notifications.filter((entry) => !entry.read).length

export function NotificationsMenu() {
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative grid size-[34px] place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <BellIcon className="size-[18px]" />
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0 grid h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-phishing px-1 font-mono text-[9px] font-semibold text-background">
            {unreadCount}
          </span>
        ) : null}
        <span className="sr-only">Benachrichtigungen</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Benachrichtigungen</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {latest.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              onClick={() => navigate(entry.target)}
              className="items-start gap-3"
            >
              <span
                className={`mt-1.5 size-[7px] shrink-0 rounded-full ${toneDot[entry.tone]}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">
                  {entry.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {entry.detail}
                </span>
                <span className="mt-0.5 block font-mono text-[10.5px] text-faint">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <div className="p-1">
          <Button
            variant="ghost"
            className="w-full text-xs"
            onClick={() => navigate("/benachrichtigungen")}
          >
            Alle Benachrichtigungen ansehen
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
