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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type RemoveMemberDialogProps = {
  name: string
  email: string
  initials: string
  teamName: string
  /** An invitation is withdrawn rather than removed, so the wording differs. */
  isInvitation?: boolean
  disabled?: boolean
  onConfirm: () => void
}

export function RemoveMemberDialog({
  name,
  email,
  initials,
  teamName,
  isInvitation = false,
  disabled,
  onConfirm,
}: RemoveMemberDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button variant="ghost" size="sm" className="text-phishing" />}
      >
        {isInvitation ? "Zurückziehen" : "Entfernen"}
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isInvitation ? "Einladung zurückziehen" : "Mitglied entfernen"}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {name ? (
              <div className="truncate text-sm font-semibold">{name}</div>
            ) : null}
            <div className="truncate text-xs text-muted-foreground">
              {email}
            </div>
          </div>
        </div>

        <AlertDialogDescription>
          {isInvitation
            ? "Die Einladung wird ungültig, der verschickte Link funktioniert danach nicht mehr. Du kannst die Person jederzeit erneut einladen."
            : `Der Zugriff auf die Analysen des Teams ${teamName} endet sofort. Bereits erstellte Analysen bleiben erhalten und behalten den Namen des Bearbeiters.`}
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {isInvitation ? "Zurückziehen" : "Entfernen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
