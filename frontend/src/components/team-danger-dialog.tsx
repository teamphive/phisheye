import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/api"

type TeamDangerDialogProps = {
  mode: "leave" | "delete"
  teamName: string
  /** The dialog stays open until it resolves and shows why it failed. */
  onConfirm: () => Promise<void>
}

export function TeamDangerDialog({
  mode,
  teamName,
  onConfirm,
}: TeamDangerDialogProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDelete = mode === "delete"
  // Deleting takes the whole team down, so it asks for the name to be typed out.
  const confirmed = !isDelete || typed.trim() === teamName

  function change(next: boolean) {
    if (pending) return

    setOpen(next)

    if (!next) {
      setTyped("")
      setError(null)
    }
  }

  async function confirm() {
    setPending(true)
    setError(null)

    try {
      await onConfirm()
      setOpen(false)
      setTyped("")
    } catch (confirmError) {
      setError(errorMessage(confirmError))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger
        render={
          <Button variant={isDelete ? "destructive" : "outline"} size="sm" />
        }
      >
        {isDelete ? "Löschen" : "Verlassen"}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isDelete ? "Team löschen" : "Team verlassen"}
          </DialogTitle>
        </DialogHeader>

        <DialogDescription>
          {isDelete
            ? `${teamName} wird mit allen Analysen und offenen Einladungen gelöscht. Alle Mitglieder verlieren sofort den Zugriff. Das lässt sich nicht rückgängig machen.`
            : `Du verlierst den Zugriff auf die Analysen von ${teamName}. Von dir erstellte Analysen bleiben im Team erhalten. Ein Admin kann dich jederzeit wieder einladen.`}
        </DialogDescription>

        {isDelete ? (
          <Field>
            <FieldLabel htmlFor="confirm-team-name">
              Zum Bestätigen den Teamnamen eingeben
            </FieldLabel>
            <Input
              id="confirm-team-name"
              autoComplete="off"
              placeholder={teamName}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
        ) : null}

        {error ? <p className="text-sm text-phishing">{error}</p> : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Abbrechen
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!confirmed || pending}
            onClick={confirm}
          >
            {pending ? <Spinner /> : null}
            {isDelete ? "Endgültig löschen" : "Verlassen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
