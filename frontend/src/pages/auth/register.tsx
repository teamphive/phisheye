import { Link, useNavigate } from "react-router"

import { AuthBrand, AuthSplit } from "@/components/auth-shell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterPage() {
  const navigate = useNavigate()

  return (
    <AuthSplit
      aside={
        <>
          <AuthBrand />

          <div className="flex flex-col gap-4">
            <p className="max-w-[26ch] text-[19px] leading-snug font-medium tracking-tight">
              Du wurdest zum Team IT-Security eingeladen.
            </p>
            <Card className="shadow-none">
              <CardContent className="flex items-center gap-3">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[10px]">LB</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-[13px] font-semibold">L. Brinkmann</div>
                  <div className="text-faint font-mono text-[11px]">
                    Admin · eingeladen am 27.08.2026
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-faint font-mono text-[11px]">
            Registrierung nur mit Einladungslink
          </p>
        </>
      }
    >
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Konto erstellen</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Nach dem Anlegen richtest du direkt 2FA ein.
        </p>
      </div>

      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(event) => {
          event.preventDefault()
          navigate("/einrichtung/2fa")
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="register-name">Anzeigename</Label>
          <Input id="register-name" placeholder="Vorname Nachname" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="register-mail">E-Mail-Adresse</Label>
          <Input
            id="register-mail"
            type="email"
            defaultValue="a.hoffmann@hansa-logistik.de"
            disabled
          />
          <p className="text-faint text-[11.5px]">Aus der Einladung übernommen</p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="register-password">Passwort</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="Mindestens 12 Zeichen"
          />
          <p className="text-faint text-[11.5px]">
            Mindestens 12 Zeichen, davon eine Ziffer und ein Sonderzeichen.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="register-password-repeat">Passwort wiederholen</Label>
          <Input id="register-password-repeat" type="password" autoComplete="new-password" />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Konto erstellen
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-xs">
        Schon ein Konto?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Anmelden
        </Link>
      </p>
    </AuthSplit>
  )
}
