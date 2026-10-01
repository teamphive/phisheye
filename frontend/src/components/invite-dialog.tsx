import { useState, type FormEvent } from "react"
import { toast } from "sonner"

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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/api"
import { isDefaultTeam, rolesFor } from "@/lib/instance"
import { inviteMember } from "@/lib/team"
import { roleLabel, type Team, type TeamRole } from "@/mocks/session"
import {
  instanceRoleDescription,
  roleDescription,
  type Invitation,
} from "@/mocks/team"

// Only catches typos, the backend decides which addresses are allowed
const plausibleAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type InviteDialogProps = {
  team: Pick<Team, "id" | "name">
  onInvited: (invitation: Invitation) => void
}

export function InviteDialog({ team, onInvited }: InviteDialogProps) {
  const roles = rolesFor(team)
  // A role in the default team opens every team
  const instanceTeam = isDefaultTeam(team)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<TeamRole>(roles[0])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  function describe(entry: TeamRole) {
    return instanceTeam && entry !== "analyst"
      ? instanceRoleDescription[entry]
      : roleDescription[entry]
  }

  function change(next: boolean) {
    if (sending) return

    setOpen(next)
    if (!next) {
      setEmail("")
      setRole(roles[0])
      setError(null)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()

    const address = email.trim().toLowerCase()
    if (!plausibleAddress.test(address)) {
      setError("Das ist keine gültige E-Mail-Adresse.")
      return
    }

    setSending(true)
    try {
      const invitation = await inviteMember(team.id, address, role)
      onInvited(invitation)
      toast.success(`Einladung an ${invitation.email} verschickt`)
      setOpen(false)
      setEmail("")
      setRole(roles[0])
    } catch (inviteError) {
      setError(errorMessage(inviteError))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger render={<Button />}>Mitglied einladen</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Mitglied einladen</DialogTitle>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="invite-mail">E-Mail-Adresse</FieldLabel>
              <Input
                id="invite-mail"
                type="email"
                placeholder="name@hansa-logistik.de"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError(null)
                }}
                disabled={sending}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
              />
              {error ? (
                <FieldError>{error}</FieldError>
              ) : (
                <FieldDescription>
                  Nur Adressen der Unternehmensdomain sind erlaubt.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="invite-role">Rolle</FieldLabel>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as TeamRole)}
                disabled={sending}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue>
                    {(entry) => roleLabel[entry as TeamRole]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {roleLabel[entry]} — {describe(entry)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {instanceTeam ? (
                <FieldDescription>
                  Im Standard-Team gibt es keine Analysten. Beide Rollen sehen
                  die Mails aller Teams, lade nur Personen ein, die das
                  brauchen.
                </FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={sending} />}
            >
              Abbrechen
            </DialogClose>
            <Button type="submit" disabled={sending || !email.trim()}>
              {sending ? <Spinner /> : null}
              Einladung senden
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
