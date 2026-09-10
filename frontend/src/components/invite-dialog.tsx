import { useState } from "react"

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
import { roleLabel, type TeamRole } from "@/mocks/session"
import { roleDescription } from "@/mocks/team"

const roles: TeamRole[] = ["analyst", "admin", "audit"]

export function InviteDialog() {
  const [role, setRole] = useState<TeamRole>("analyst")

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Mitglied einladen</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mitglied einladen</DialogTitle>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="invite-mail">E-Mail-Adresse</FieldLabel>
            <Input
              id="invite-mail"
              type="email"
              placeholder="name@hansa-logistik.de"
            />
            <FieldDescription>
              Nur Adressen der Unternehmensdomain sind erlaubt.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="invite-role">Rolle</FieldLabel>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as TeamRole)}
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
          <DialogClose render={<Button variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button>Einladung senden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
