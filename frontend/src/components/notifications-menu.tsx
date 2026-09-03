import { useNavigate } from "react-router"
import { BellIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { unreadNotifications } from "@/mocks/session"

// Placeholder entries until the notifications endpoint exists.
const entries = [
  {
    id: "1",
    tone: "bg-phishing",
    title: "Analyse abgeschlossen — Phishing (100 %)",
    detail: "„Ihre Rechnung RE-2024-88431 ist überfällig“",
    meta: "vor 12 Min",
  },
  {
    id: "2",
    tone: "bg-suspicious",
    title: "Analyse abgeschlossen — Verdächtig (68 %)",
    detail: "„AW: Angebot Q3 – bitte kurzfristig freigeben“",
    meta: "vor 1 Std",
  },
  {
    id: "3",
    tone: "bg-primary",
    title: "T. Özdemir ist dem Team beigetreten",
    detail: "Rolle: Analyst",
    meta: "gestern, 16:04",
  },
]

export function NotificationsMenu() {
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-muted-foreground hover:bg-muted hover:text-foreground relative grid size-[34px] place-items-center rounded-md">
        <BellIcon className="size-[18px]" />
        {unreadNotifications > 0 ? (
          <span className="bg-phishing text-background border-background font-mono absolute top-0.5 right-0 grid h-4 min-w-4 place-items-center rounded-full border-2 px-1 text-[9px] font-semibold">
            {unreadNotifications}
          </span>
        ) : null}
        <span className="sr-only">Benachrichtigungen</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px]">
        <DropdownMenuLabel>Benachrichtigungen</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {entries.map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            onClick={() => navigate("/analysen")}
            className="items-start gap-3"
          >
            <span className={`mt-1.5 size-[7px] shrink-0 rounded-full ${entry.tone}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{entry.title}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {entry.detail}
              </span>
              <span className="text-faint font-mono mt-0.5 block text-[10.5px]">
                {entry.meta}
              </span>
            </span>
          </DropdownMenuItem>
        ))}

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
