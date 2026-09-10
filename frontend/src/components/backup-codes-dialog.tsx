import { useState } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { backupCodes, security } from "@/mocks/session"

function asText() {
  return `phisheye Backup-Codes\n\n${backupCodes.join("\n")}\n`
}

export function BackupCodesDialog() {
  const [open, setOpen] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText())
      toast.success("Codes in die Zwischenablage kopiert")
    } catch {
      toast.error("Kopieren nicht möglich")
    }
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([asText()], { type: "text/plain" })
    )
    const link = document.createElement("a")

    link.href = url
    link.download = "phisheye-backup-codes.txt"
    link.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Neu erzeugen
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Backup-Codes neu erzeugen</DialogTitle>
        </DialogHeader>

        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            Deine bisherigen {security.backupCodesUnused} Codes werden dabei
            ungültig. Speichere die neuen, bevor du das Fenster schließt — sie
            werden kein zweites Mal angezeigt.
          </AlertDescription>
        </Alert>

        <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-[13px]">
          {backupCodes.map((code) => (
            <li key={code} className="text-center tracking-wider">
              {code}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button variant="outline" onClick={copy}>
            Kopieren
          </Button>
          <Button onClick={download}>Herunterladen und schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
