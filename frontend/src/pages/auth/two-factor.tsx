import { useState } from "react"
import { Link, useNavigate } from "react-router"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { currentUser } from "@/mocks/session"

export function TwoFactorPage() {
  const navigate = useNavigate()
  const [useBackupCode, setUseBackupCode] = useState(false)

  return (
    <AuthCard>
      <AuthBrand centered />

      <div className="text-center">
        <h1 className="text-[21px] font-semibold tracking-tight">
          {useBackupCode ? "Backup-Code eingeben" : "Bestätigungscode eingeben"}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {useBackupCode
            ? "Einer der Codes, die du bei der Einrichtung gesichert hast. Jeder Code funktioniert nur einmal."
            : "Sechsstelliger Code aus deiner Authenticator-App"}
        </p>
      </div>

      {useBackupCode ? (
        <div className="grid gap-1.5">
          <Label htmlFor="backup-code">Backup-Code</Label>
          <Input
            id="backup-code"
            placeholder="XXXX-XXXX"
            autoComplete="one-time-code"
            className="text-center font-mono tracking-widest"
            autoFocus
          />
        </div>
      ) : (
        <div className="flex justify-center">
          <InputOTP maxLength={6} autoFocus>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      )}

      <Button size="lg" className="w-full" onClick={() => navigate("/")}>
        Bestätigen
      </Button>

      <p className="text-center">
        <button
          type="button"
          onClick={() => setUseBackupCode((value) => !value)}
          className="text-primary text-xs hover:underline"
        >
          {useBackupCode
            ? "Stattdessen Code aus der App verwenden"
            : "Stattdessen Backup-Code verwenden"}
        </button>
      </p>

      <Separator />

      <p className="text-faint text-center text-xs">
        Angemeldet als {currentUser.email} ·{" "}
        <Link to="/login" className="hover:underline">
          abbrechen
        </Link>
      </p>
    </AuthCard>
  )
}
