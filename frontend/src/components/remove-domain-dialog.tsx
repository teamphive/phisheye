import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type RemoveDomainDialogProps = {
  domain: string
  teamName: string
  disabled?: boolean
  onConfirm: () => void
}

export function RemoveDomainDialog({
  domain,
  teamName,
  disabled,
  onConfirm,
}: RemoveDomainDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button variant="ghost" size="sm" className="text-phishing" />}
      >
        Entfernen
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Domain entfernen</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="rounded-lg border bg-muted/50 p-3 font-mono text-[13px] font-semibold">
          {domain}
        </div>

        <AlertDialogDescription>
          Gemeldete Mails von {domain} und ihren Subdomains kommen danach nicht
          mehr im Team {teamName} an. Bereits erstellte Analysen bleiben
          erhalten. Danach kann ein anderes Team die Domain eintragen.
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Entfernen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
