import { useState, type FormEvent } from "react"
import { PlusIcon } from "lucide-react"
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
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/api"
import { selectTeam } from "@/lib/session"
import { createTeam } from "@/lib/team"

type CreateTeamDialogProps = {
  /** When controlled from elsewhere the dialog renders no trigger of its own. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Reloads the session, the new team is already the active one by then. */
  onCreated: () => Promise<unknown>
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateTeamDialogProps) {
  const controlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const isOpen = controlled ? open : internalOpen

  function setOpen(next: boolean) {
    onOpenChange?.(next)
    if (!controlled) setInternalOpen(next)

    if (!next) {
      setName("")
      setError(null)
    }
  }

  // Closing by hand waits until the request is through
  function change(next: boolean) {
    if (!creating) setOpen(next)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Das Team braucht einen Namen.")
      return
    }

    setCreating(true)
    try {
      const team = await createTeam(trimmed)
      // The creator works in the new team right away
      await selectTeam(team.id)
      await onCreated()
      toast.success(`Team ${team.name} erstellt`, {
        description: "Du bist Admin und kannst jetzt Mitglieder einladen.",
      })
      setCreating(false)
      setOpen(false)
    } catch (createError) {
      setError(errorMessage(createError))
      setCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={change}>
      {controlled ? null : (
        <DialogTrigger render={<Button variant="outline" />}>
          <PlusIcon className="size-4" />
          Team erstellen
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Team erstellen</DialogTitle>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="new-team-name">Teamname</FieldLabel>
              <Input
                id="new-team-name"
                placeholder="z. B. SOC Bereitschaft"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
                disabled={creating}
                aria-invalid={error ? true : undefined}
              />
              {error ? (
                <FieldError>{error}</FieldError>
              ) : (
                <FieldDescription>
                  Unter diesem Namen erscheint das Team im Umschalter oben
                  rechts.
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>

          <p className="text-[12.5px] text-muted-foreground">
            Du wirst automatisch Admin des neuen Teams und kannst anschließend
            Mitglieder einladen. Analysen bleiben pro Team getrennt.
          </p>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={creating} />}
            >
              Abbrechen
            </DialogClose>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? <Spinner /> : null}
              Team erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
