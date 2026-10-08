import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { SecurityCard } from "@/components/security-card"
import { useSession } from "@/components/session-provider"
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
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { errorMessage } from "@/lib/api"
import { teamRoleLabel } from "@/lib/instance"
import { authEnabled, logout } from "@/lib/keycloak"
import { updateProfile } from "@/lib/session"
import { instanceRoleLabel } from "@/mocks/session"

const schemes = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
] as const

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, activeTeam, refresh } = useSession()
  const [displayName, setDisplayName] = useState(user.name)
  const [saving, setSaving] = useState(false)

  const trimmedName = displayName.trim()

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!trimmedName || trimmedName === user.name) return

    setSaving(true)
    try {
      await updateProfile(trimmedName)
      await refresh()
      toast.success("Anzeigename gespeichert")
    } catch (error) {
      toast.error("Anzeigename konnte nicht gespeichert werden", {
        description: errorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <PageHeader
        title="Einstellungen"
        description="Konto, Sicherheit und Darstellung"
      />

      <Card>
        <form onSubmit={saveProfile} className="contents">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Profil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-[52px]">
                <AvatarFallback className="bg-muted text-base font-medium text-foreground">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{user.name}</span>
                  {user.instanceRole ? (
                    <Badge variant="secondary">
                      {instanceRoleLabel[user.instanceRole]}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {teamRoleLabel(activeTeam)} · Team {activeTeam.name}
                </div>
              </div>
            </div>

            <FieldGroup className="grid grid-cols-2 gap-3.5">
              <Field>
                <FieldLabel htmlFor="display-name">Anzeigename</FieldLabel>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">E-Mail-Adresse</FieldLabel>
                <Input id="email" defaultValue={user.email} disabled />
                <FieldDescription>Wird vom Admin verwaltet</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              disabled={saving || !trimmedName || trimmedName === user.name}
            >
              {saving ? <Spinner /> : null}
              Speichern
            </Button>
          </CardFooter>
        </form>
      </Card>

      <SecurityCard />

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
                  else
                    toast.info("Geht nur mit Keycloak", {
                      description:
                        "Ohne Keycloak gibt es keine Anmeldung, die sich beenden ließe.",
                    })
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
