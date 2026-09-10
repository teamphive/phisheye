import { useNavigate } from "react-router"

import { BackupCodesDialog } from "@/components/backup-codes-dialog"
import { PageHeader } from "@/components/page-header"
import { PasswordDialog } from "@/components/password-dialog"
import { SessionsDialog } from "@/components/sessions-dialog"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDate } from "@/lib/format"
import { authEnabled, logout, openAccount } from "@/lib/keycloak"
import { sessionUser } from "@/lib/session"
import { roleLabel, security, teams } from "@/mocks/session"

const schemes = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
] as const

export function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const user = sessionUser()
  const activeTeam = teams[0]

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <PageHeader
        title="Einstellungen"
        description="Konto, Sicherheit und Darstellung"
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Profil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar className="size-[52px]">
              <AvatarFallback className="bg-primary text-[17px] font-semibold text-primary-foreground">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-[15px] font-semibold">{user.name}</div>
              <div className="font-mono text-[11.5px] text-faint">
                {roleLabel[activeTeam.role]} · Team {activeTeam.name}
              </div>
            </div>
          </div>

          <FieldGroup className="grid grid-cols-2 gap-3.5">
            <Field>
              <FieldLabel htmlFor="display-name">Anzeigename</FieldLabel>
              <Input id="display-name" defaultValue={user.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">E-Mail-Adresse</FieldLabel>
              <Input id="email" defaultValue={user.email} disabled />
              <FieldDescription>Wird vom Admin verwaltet</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button>Speichern</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Sicherheit</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-0">
            {authEnabled ? (
              <>
                <Item className="px-0 py-3.5">
                  <ItemContent>
                    <ItemTitle>Kontoeinstellungen</ItemTitle>
                    <ItemDescription>
                      Passwort, zweiter Faktor und angemeldete Geräte werden in
                      Keycloak verwaltet.
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button variant="outline" size="sm" onClick={openAccount}>
                      Öffnen
                    </Button>
                  </ItemActions>
                </Item>

                <ItemSeparator className="my-0" />
              </>
            ) : null}

            <Item className="px-0 py-3.5">
              <ItemContent>
                <ItemTitle>Passwort</ItemTitle>
                <ItemDescription>
                  Zuletzt geändert am {formatDate(security.passwordChangedAt)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <PasswordDialog />
              </ItemActions>
            </Item>

            <ItemSeparator className="my-0" />

            <Item className="px-0 py-3.5">
              <ItemContent>
                <ItemTitle>
                  Zwei-Faktor-Authentifizierung
                  {security.twoFactorEnabled ? (
                    <Badge variant="clean">
                      <span className="size-1.5 rounded-full bg-current" />
                      Aktiv
                    </Badge>
                  ) : null}
                </ItemTitle>
                <ItemDescription>
                  {security.twoFactorMethod}, eingerichtet am{" "}
                  {formatDate(security.twoFactorSetUpAt)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/einrichtung/2fa")}
                >
                  Neu einrichten
                </Button>
                <Button variant="destructive" size="sm">
                  Deaktivieren
                </Button>
              </ItemActions>
            </Item>

            <ItemSeparator className="my-0" />

            <Item className="px-0 py-3.5">
              <ItemContent>
                <ItemTitle>Backup-Codes</ItemTitle>
                <ItemDescription>
                  {security.backupCodesUnused} von {security.backupCodesTotal}{" "}
                  Codes noch nicht verwendet
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <BackupCodesDialog />
              </ItemActions>
            </Item>

            <ItemSeparator className="my-0" />

            <Item className="px-0 py-3.5">
              <ItemContent>
                <ItemTitle>Aktive Sitzungen</ItemTitle>
                <ItemDescription>
                  {security.sessionCount} Geräte · zuletzt{" "}
                  {security.lastSessionAgent},{" "}
                  {formatDate(security.lastSessionAt)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <SessionsDialog />
              </ItemActions>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Darstellung</CardTitle>
        </CardHeader>
        <CardContent>
          <Item className="px-0 py-3.5">
            <ItemContent>
              <ItemTitle>Farbschema</ItemTitle>
              <ItemDescription>
                Folgt standardmäßig der Einstellung deines Betriebssystems.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ToggleGroup
                value={[theme]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next) setTheme(next as typeof theme)
                }}
                variant="outline"
                size="sm"
              >
                {schemes.map((scheme) => (
                  <ToggleGroupItem key={scheme.value} value={scheme.value}>
                    {scheme.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </ItemActions>
          </Item>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Item className="px-0 py-3.5">
            <ItemContent>
              <ItemTitle>Abmelden</ItemTitle>
              <ItemDescription>
                Beendet die Sitzung auf diesem Gerät.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (authEnabled) logout()
                  else navigate("/login")
                }}
              >
                Abmelden
              </Button>
            </ItemActions>
          </Item>
        </CardContent>
      </Card>
    </div>
  )
}
