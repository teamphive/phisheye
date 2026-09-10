import { useNavigate } from "react-router"

import { BackupCodesDialog } from "@/components/backup-codes-dialog"
import { PageHeader } from "@/components/page-header"
import { PasswordDialog } from "@/components/password-dialog"
import { SessionsDialog } from "@/components/sessions-dialog"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { currentUser, roleLabel, security, teams } from "@/mocks/session"

const schemes = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
] as const

export function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const activeTeam = teams[0]

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Einstellungen"
        description="Konto, Sicherheit und Darstellung"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback>{currentUser.initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-[15px] font-semibold">
                {currentUser.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {roleLabel[activeTeam.role]} · Team {activeTeam.name}
              </div>
            </div>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="display-name">Anzeigename</FieldLabel>
              <Input id="display-name" defaultValue={currentUser.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">E-Mail-Adresse</FieldLabel>
              <Input id="email" defaultValue={currentUser.email} disabled />
              <FieldDescription>Wird vom Admin verwaltet</FieldDescription>
            </Field>
          </FieldGroup>

          <div>
            <Button>Speichern</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sicherheit</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <Item>
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

            <ItemSeparator />

            <Item>
              <ItemContent>
                <ItemTitle>
                  Zwei-Faktor-Authentifizierung
                  {security.twoFactorEnabled ? (
                    <Badge variant="secondary">Aktiv</Badge>
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

            <ItemSeparator />

            <Item>
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

            <ItemSeparator />

            <Item>
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
        <CardHeader>
          <CardTitle className="text-sm">Darstellung</CardTitle>
        </CardHeader>
        <CardContent>
          <Item>
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
          <Item>
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
                onClick={() => navigate("/login")}
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
