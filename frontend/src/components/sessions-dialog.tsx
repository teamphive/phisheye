import { useState } from "react"
import { toast } from "sonner"

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
import { Spinner } from "@/components/ui/spinner"
import { deviceName, signOutDevice, signOutOtherDevices } from "@/lib/account"
import { errorMessage } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { Device } from "@/mocks/session"

/** The browsers Keycloak has sessions for, each can be signed out. */
export function SessionsDialog({
  devices,
  onChange,
}: {
  devices: Device[]
  /** Called after a sign out, the list comes fresh from Keycloak. */
  onChange: () => void
}) {
  const [pending, setPending] = useState<string | null>(null)

  async function signOut(key: string, run: () => Promise<void>) {
    setPending(key)
    try {
      await run()
      onChange()
    } catch (error) {
      toast.error("Abmelden fehlgeschlagen", {
        description: errorMessage(error),
      })
    } finally {
      setPending(null)
    }
  }

  const others = devices.filter((device) => !device.current).length

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
          {devices.map((device) => {
            const key = device.sessionIds.join(",")

            return (
              <Item key={key} variant="outline" className="p-3">
                <ItemContent>
                  <ItemTitle>
                    {deviceName(device)}
                    {device.current ? (
                      <Badge variant="secondary">Dieses Gerät</Badge>
                    ) : null}
                  </ItemTitle>
                  <ItemDescription>
                    {device.ipAddress} ·{" "}
                    {device.current
                      ? "gerade aktiv"
                      : `zuletzt ${formatRelativeTime(device.lastAccess)}`}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {device.current ? (
                    <span className="text-sm text-faint">—</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() => signOut(key, () => signOutDevice(device))}
                    >
                      {pending === key ? <Spinner /> : null}
                      Abmelden
                    </Button>
                  )}
                </ItemActions>
              </Item>
            )
          })}
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
            disabled={others === 0 || pending !== null}
            onClick={() => signOut("others", signOutOtherDevices)}
          >
            {pending === "others" ? <Spinner /> : null}
            Alle anderen abmelden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
