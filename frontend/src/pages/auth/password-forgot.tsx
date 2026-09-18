import { useState } from "react"
import { Link } from "react-router"
import { MailIcon } from "lucide-react"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordForgotPage() {
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <AuthCard>
        <AuthBrand centered />

        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="bg-clean-soft text-clean grid size-[46px] place-items-center rounded-xl">
            <MailIcon className="size-[22px]" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            Prüfe dein Postfach
          </h1>
          <p className="text-muted-foreground max-w-[40ch] text-sm">
            Falls ein Konto zu dieser Adresse existiert, ist eine E-Mail mit dem
            Link unterwegs. Der Link ist 60 Minuten gültig.
          </p>
        </div>

        <Button variant="outline" size="lg" className="w-full" onClick={() => setSent(false)}>
          Erneut senden
        </Button>

        <p className="text-center">
          <Link to="/login" className="text-primary text-xs hover:underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <AuthBrand centered />

      <div className="text-center">
        <h1 className="text-[21px] font-semibold tracking-tight">
          Passwort vergessen
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst.
        </p>
      </div>

      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(event) => {
          event.preventDefault()
          setSent(true)
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="forgot-mail">E-Mail-Adresse</Label>
          <Input id="forgot-mail" type="email" placeholder="name@hansa-logistik.de" />
        </div>

        <Button type="submit" size="lg" className="w-full">
          Link anfordern
        </Button>
      </form>

      <p className="text-center">
        <Link to="/login" className="text-primary text-xs hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </AuthCard>
  )
}
