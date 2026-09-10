import { PlusIcon } from "lucide-react"

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

export function CreateTeamDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon className="size-4" />
        Team erstellen
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Team erstellen</DialogTitle>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="new-team-name">Teamname</FieldLabel>
            <Input id="new-team-name" placeholder="z. B. SOC Bereitschaft" />
            <FieldDescription>
              Unter diesem Namen erscheint das Team im Umschalter oben rechts.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="new-team-description">
              Beschreibung{" "}
              <span className="font-normal text-faint">(optional)</span>
            </FieldLabel>
            <Input
              id="new-team-description"
              placeholder="Wofür ist dieses Team zuständig?"
            />
          </Field>
        </FieldGroup>

        <p className="text-[12.5px] text-muted-foreground">
          Du wirst automatisch Admin des neuen Teams und kannst anschließend
          Mitglieder einladen. Analysen bleiben pro Team getrennt.
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button>Team erstellen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
