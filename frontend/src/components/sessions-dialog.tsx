import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { formatRelativeTime } from "@/lib/format"
import { sessions as initialSessions } from "@/mocks/session"

export function SessionsDialog() {
  const [sessions, setSessions] = useState(initialSessions)

  function revoke(id: string) {
    setSessions((current) => current.filter((session) => session.id !== id))
  }

  function revokeOthers() {
    setSessions((current) => current.filter((session) => session.current))
  }

  const others = sessions.filter((session) => !session.current).length

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Verwalten
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aktive Sitzungen</DialogTitle>
        </DialogHeader>

        <ItemGroup>
          {sessions.map((session) => (
            <Item key={session.id} variant="outline" className="p-3">
              <ItemContent>
                <ItemTitle>
                  {session.agent}
                  {session.current ? (
                    <Badge variant="secondary">Dieses Gerät</Badge>
                  ) : null}
                </ItemTitle>
                <ItemDescription>
                  {session.location} · {session.ip} ·{" "}
                  {session.current
                    ? "gerade aktiv"
                    : `zuletzt ${formatRelativeTime(session.lastActiveAt)}`}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {session.current ? (
                  <span className="text-sm text-faint">—</span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revoke(session.id)}
                  >
                    Abmelden
                  </Button>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>

        <p className="text-xs text-muted-foreground">
          Kennst du ein Gerät nicht, melde es ab und ändere dein Passwort.
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Schließen
          </DialogClose>
          <Button
            variant="destructive"
            disabled={others === 0}
            onClick={revokeOthers}
          >
            Alle anderen abmelden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
