import { useNavigate } from "react-router"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordResetPage() {
  const navigate = useNavigate()

  return (
    <AuthCard>
      <AuthBrand centered />

      <div className="text-center">
        <h1 className="text-[21px] font-semibold tracking-tight">
          Neues Passwort setzen
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Für m.sandmann@hansa-logistik.de
        </p>
      </div>

      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(event) => {
          event.preventDefault()
          navigate("/login")
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="reset-password">Neues Passwort</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="Mindestens 12 Zeichen"
          />
          <p className="text-faint text-[11.5px]">
            Mindestens 12 Zeichen, davon eine Ziffer und ein Sonderzeichen.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="reset-password-repeat">Passwort wiederholen</Label>
          <Input id="reset-password-repeat" type="password" autoComplete="new-password" />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Passwort speichern
        </Button>
      </form>

      <p className="text-faint text-center text-xs">
        Nach dem Speichern wirst du auf allen Geräten abgemeldet.
      </p>
    </AuthCard>
  )
}
