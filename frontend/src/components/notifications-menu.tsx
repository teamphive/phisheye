import { useNavigate } from "react-router"
import { BellIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNotifications } from "@/components/notifications-provider"
import { formatRelativeTime } from "@/lib/format"
import type { NotificationTone } from "@/mocks/notifications"

const toneDot: Record<NotificationTone, string> = {
  phishing: "bg-phishing",
  suspicious: "bg-suspicious",
  clean: "bg-clean",
  info: "bg-primary",
}

export function NotificationsMenu() {
  const navigate = useNavigate()
  const { entries, loadError, unreadCount, markRead } = useNotifications()

  // The API sends unread entries first, so these are the ones that matter.
  const latest = (entries ?? []).slice(0, 3)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative grid size-[34px] place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <BellIcon className="size-[18px]" />
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0 grid h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-phishing px-1 text-[9px] font-semibold text-background">
            {unreadCount}
          </span>
        ) : null}
        <span className="sr-only">Benachrichtigungen</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Benachrichtigungen</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {loadError ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Benachrichtigungen konnten nicht geladen werden. {loadError}
            </p>
          ) : entries === null ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Wird geladen …
            </p>
          ) : latest.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Keine Benachrichtigungen.
            </p>
          ) : null}

          {latest.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              onClick={() => {
                markRead(entry)
                navigate(entry.target)
              }}
              className="items-start gap-3"
            >
              <span
                className={`mt-1.5 size-[7px] shrink-0 rounded-full ${toneDot[entry.tone]}`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${
                    entry.read
                      ? "font-medium text-muted-foreground"
                      : "font-semibold"
                  }`}
                >
                  {entry.title}
                  {entry.read ? null : (
                    <span className="sr-only"> (ungelesen)</span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {entry.detail}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        {/* A menu item, not a button, so the menu closes on the way out */}
        <DropdownMenuItem
          onClick={() => navigate("/benachrichtigungen")}
          className="justify-center text-xs font-medium"
        >
          Alle Benachrichtigungen ansehen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
