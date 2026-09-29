import { useEffect, useState } from "react"
import { toast } from "sonner"

import { SessionsDialog } from "@/components/sessions-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { deviceName, fetchAccountSecurity } from "@/lib/account"
import { errorMessage } from "@/lib/api"
import { formatDate, formatRelativeTime } from "@/lib/format"
import {
  authEnabled,
  openAccount,
  runAccountAction,
  takeFinishedAction,
  type AccountAction,
} from "@/lib/keycloak"
import type { AccountSecurity } from "@/mocks/session"

const confirmations: Record<string, string> = {
  UPDATE_PASSWORD: "Passwort geändert",
  CONFIGURE_TOTP: "Authenticator-App eingerichtet",
  CONFIGURE_RECOVERY_AUTHN_CODES: "Neue Backup-Codes gespeichert",
}

function confirmation(action: string) {
  if (action.startsWith("delete_credential")) return "Gerät entfernt"
  return confirmations[action] ?? "Gespeichert"
}

// From this many unused codes on it is time for new ones
const fewCodes = 3

function run(action: AccountAction) {
  // Without Keycloak nobody is there to take the change
  if (!authEnabled) {
    toast.info("Geht nur mit Keycloak", {
      description: "Ohne Keycloak zeigt die App Platzhalterwerte.",
    })
    return
  }

  runAccountAction(action)
}

/**
 * Password, second factor, backup codes and devices as Keycloak knows them.
 * Every change runs on Keycloak's own pages, the app only reads.
 */
export function SecurityCard() {
  const [security, setSecurity] = useState<AccountSecurity | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  // Back from one of Keycloak's pages: say how it went
  useEffect(() => {
    const finished = takeFinishedAction()
    if (!finished || finished.status === "cancelled") return

    if (finished.status === "success") {
      toast.success(confirmation(finished.action))
    } else {
      toast.error("Keycloak konnte die Änderung nicht speichern")
    }
  }, [])

  useEffect(() => {
    let active = true

    fetchAccountSecurity().then(
      (data) => {
        if (active) setSecurity(data)
      },
      (loadError: unknown) => {
        if (active) setError(loadError)
      }
    )

    return () => {
      active = false
    }
  }, [attempt])

  // The old values stay until the new ones are there
  function reload() {
    setError(null)
    setAttempt((current) => current + 1)
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-sm">Sicherheit</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-col items-start gap-3 py-3.5">
            <Alert variant="destructive">
              <AlertDescription>
                Die Kontodaten konnten nicht aus Keycloak geladen werden.{" "}
                {errorMessage(error)}
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={reload}>
              Erneut versuchen
            </Button>
          </div>
        ) : security ? (
          <SecurityItems security={security} onChange={reload} />
        ) : (
          <div className="flex flex-col gap-5 py-3.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-[34%]" />
                <Skeleton className="h-3 w-[52%]" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SecurityItems({
  security,
  onChange,
}: {
  security: AccountSecurity
  onChange: () => void
}) {
  const { authenticators, recoveryCodes, devices } = security

  const unused =
    recoveryCodes?.used != null && recoveryCodes.total != null
      ? recoveryCodes.total - recoveryCodes.used
      : null
  const lastOther = devices.find((device) => !device.current)

  return (
    <ItemGroup className="gap-0">
      <Item className="px-0 py-3.5">
        <ItemContent>
          <ItemTitle>Passwort</ItemTitle>
          <ItemDescription>
            {security.passwordChangedAt
              ? `Zuletzt geändert am ${formatDate(security.passwordChangedAt)}`
              : "Noch kein Passwort gesetzt"}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run("UPDATE_PASSWORD")}
          >
            Ändern
          </Button>
        </ItemActions>
      </Item>

      <ItemSeparator className="my-0" />

      <Item className="px-0 py-3.5">
        <ItemContent>
          <ItemTitle>
            Zwei-Faktor-Authentifizierung
            {authenticators.length > 0 ? (
              <Badge variant="clean">
                <span className="size-1.5 rounded-full bg-current" />
                Aktiv
              </Badge>
            ) : (
              <Badge variant="suspicious">Nicht eingerichtet</Badge>
            )}
          </ItemTitle>
          {authenticators.length === 0 ? (
            <ItemDescription>
              Ohne zweiten Faktor reicht ein erbeutetes Passwort für dein Konto.
            </ItemDescription>
          ) : (
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              {authenticators.map((authenticator) => (
                <div key={authenticator.id} className="flex items-center gap-2">
                  <span>
                    {authenticator.label
                      ? `„${authenticator.label}“`
                      : "Authenticator-App"}
                    , eingerichtet am {formatDate(authenticator.createdAt)}
                  </span>
                  {/* the last one stays, so the account never loses 2FA */}
                  {authenticators.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        run(`delete_credential:${authenticator.id}`)
                      }
                    >
                      Entfernen
                    </Button>
                  ) : null}
                </div>
              ))}
              {authenticators.length === 1 ? (
                <span className="text-xs text-faint">
                  Entfernen geht erst, wenn ein zweites Gerät eingerichtet ist.
                </span>
              ) : null}
            </div>
          )}
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run("CONFIGURE_TOTP")}
          >
            {authenticators.length > 0 ? "Gerät hinzufügen" : "Einrichten"}
          </Button>
        </ItemActions>
      </Item>

      <ItemSeparator className="my-0" />

      <Item className="px-0 py-3.5">
        <ItemContent>
          <ItemTitle>
            Backup-Codes
            {unused !== null && unused <= fewCodes ? (
              <Badge variant="suspicious">
                {unused === 0 ? "Aufgebraucht" : "Fast aufgebraucht"}
              </Badge>
            ) : null}
          </ItemTitle>
          <ItemDescription>
            {!recoveryCodes
              ? "Noch keine erzeugt. Mit ihnen kommst du ins Konto, wenn das Handy fehlt."
              : unused === null
                ? `Erzeugt am ${formatDate(recoveryCodes.createdAt)}`
                : `${unused} von ${recoveryCodes.total} Codes noch nicht verwendet · erzeugt am ${formatDate(recoveryCodes.createdAt)}`}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => run("CONFIGURE_RECOVERY_AUTHN_CODES")}
          >
            {recoveryCodes ? "Neu erzeugen" : "Erzeugen"}
          </Button>
        </ItemActions>
      </Item>

      <ItemSeparator className="my-0" />

      <Item className="px-0 py-3.5">
        <ItemContent>
          <ItemTitle>Aktive Sitzungen</ItemTitle>
          <ItemDescription>
            {lastOther
              ? `${devices.length} Geräte · zuletzt ${deviceName(lastOther)}, ${formatRelativeTime(lastOther.lastAccess)}`
              : "Nur dieses Gerät"}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <SessionsDialog devices={devices} onChange={onChange} />
        </ItemActions>
      </Item>

      {authEnabled ? (
        <>
          <ItemSeparator className="my-0" />

          <Item className="px-0 py-3.5">
            <ItemContent>
              <ItemTitle>Kontoverwaltung von Keycloak</ItemTitle>
              <ItemDescription>
                Alles, was hier fehlt, zum Beispiel verknüpfte Konten.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm" onClick={openAccount}>
                Öffnen
              </Button>
            </ItemActions>
          </Item>
        </>
      ) : null}
    </ItemGroup>
  )
}
