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

type TeamDangerDialogProps = {
  mode: "leave" | "delete"
  teamName: string
  onConfirm: () => void
}

export function TeamDangerDialog({
  mode,
  teamName,
  onConfirm,
}: TeamDangerDialogProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")

  const isDelete = mode === "delete"
  // Deleting takes the whole team down, so it asks for the name to be typed out.
  const confirmed = !isDelete || typed.trim() === teamName

  function change(next: boolean) {
    setOpen(next)

    if (!next) {
      setTyped("")
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

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!confirmed}
            onClick={() => {
              onConfirm()
              change(false)
            }}
          >
            {isDelete ? "Endgültig löschen" : "Verlassen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
