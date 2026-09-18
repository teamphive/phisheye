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

export function PasswordDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Ändern
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passwort ändern</DialogTitle>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="current-password">
              Aktuelles Passwort
            </FieldLabel>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">Neues Passwort</FieldLabel>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
            />
            <FieldDescription>
              Mindestens 12 Zeichen, davon eine Ziffer und ein Sonderzeichen.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="repeat-password">
              Neues Passwort wiederholen
            </FieldLabel>
            <Input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
            />
          </Field>
        </FieldGroup>

        <p className="text-xs text-muted-foreground">
          Andere Geräte bleiben angemeldet. Wenn du das nicht willst, melde sie
          unter „Aktive Sitzungen“ ab.
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button>Passwort speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
