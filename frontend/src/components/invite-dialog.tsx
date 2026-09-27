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
import { inviteMember } from "@/lib/team"
import { roleLabel, type TeamRole } from "@/mocks/session"
import { roleDescription, type Invitation } from "@/mocks/team"

const roles: TeamRole[] = ["analyst", "admin", "audit"]

// Only catches typos, the backend decides which addresses are allowed
const plausibleAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type InviteDialogProps = {
  teamId: string
  onInvited: (invitation: Invitation) => void
}

export function InviteDialog({ teamId, onInvited }: InviteDialogProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<TeamRole>("analyst")
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  function change(next: boolean) {
    if (sending) return

    setOpen(next)
    if (!next) {
      setEmail("")
      setRole("analyst")
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
      const invitation = await inviteMember(teamId, address, role)
      onInvited(invitation)
      toast.success(`Einladung an ${invitation.email} verschickt`)
      setOpen(false)
      setEmail("")
      setRole("analyst")
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
                      {roleLabel[entry]} — {roleDescription[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
