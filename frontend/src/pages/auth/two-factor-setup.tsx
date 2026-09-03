import { useNavigate } from "react-router"
import { DownloadIcon } from "lucide-react"

import { AuthCard } from "@/components/auth-shell"
import { QrPlaceholder } from "@/components/qr-placeholder"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"

const backupCodes = [
  "4KD2-9QW1",
  "7XPL-3MB8",
  "0ZT5-1RVC",
  "8HNE-6JQ4",
  "2WBS-5YFA",
  "3CKM-7DUP",
  "6VRG-0TXN",
  "1LQH-4ZEB",
]

export function TwoFactorSetupPage() {
  const navigate = useNavigate()

  return (
    <AuthCard width={560}>
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">
          Zwei-Faktor-Authentifizierung einrichten
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Pflicht für alle Team-Mitglieder.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-start gap-5">
          <QrPlaceholder className="border-border bg-card size-[148px] shrink-0 rounded-md border p-2" />
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[13.5px] font-semibold">1. QR-Code scannen</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Mit einer Authenticator-App deiner Wahl, zum Beispiel Microsoft
                Authenticator, Google Authenticator oder Aegis.
              </p>
            </div>
            <div>
              <div className="text-muted-foreground mb-1 text-xs">
                Falls das Scannen nicht klappt:
              </div>
              <code className="bg-muted border-border text-muted-foreground block rounded-md border px-3 py-2 font-mono text-[11.5px] break-all">
                JBSW Y3DP EHPK 3PXP AL5Q W7HK
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        <Label>2. Code aus der App eingeben</Label>
        <InputOTP maxLength={6}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">3. Backup-Codes sichern</CardTitle>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Jeder Code ist einmal gültig
            </p>
          </div>
          <Button variant="outline" size="sm">
            <DownloadIcon className="size-4" />
            Herunterladen
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {backupCodes.map((code) => (
              <span
                key={code}
                className="bg-muted rounded px-2 py-1 font-mono text-xs tracking-wider"
              >
                {code}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={() => navigate("/")}>
        Einrichtung abschließen
      </Button>
    </AuthCard>
  )
}
