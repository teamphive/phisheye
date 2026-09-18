import { Link, useNavigate } from "react-router"

import { AuthBrand, AuthSplit } from "@/components/auth-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <AuthSplit
      aside={
        <>
          <AuthBrand />

          <div className="flex flex-col gap-5">
            <p className="max-w-[26ch] text-[19px] leading-snug font-medium tracking-tight">
              Gemeldete Mails an einem Ort prüfen, bewerten und dokumentieren.
            </p>
            <div className="flex gap-2">
              <Badge variant="phishing">Phishing</Badge>
              <Badge variant="suspicious">Verdächtig</Badge>
              <Badge variant="clean">Sauber</Badge>
            </div>
            <p className="text-muted-foreground max-w-[34ch] text-sm">
              Header, Authentifizierung, Links und Anhänge werden nachvollziehbar
              bewertet — mit Begründung je Kriterium.
            </p>
          </div>

          <p className="text-faint font-mono text-[11px]">
            Interne Anwendung der Hansa Logistik GmbH
          </p>
        </>
      }
    >
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Anmelden</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Mit deinem Firmenkonto
        </p>
      </div>

      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(event) => {
          event.preventDefault()
          navigate("/login/2fa")
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="login-mail">E-Mail-Adresse</Label>
          <Input
            id="login-mail"
            type="email"
            autoComplete="username"
            defaultValue="m.sandmann@hansa-logistik.de"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="login-password">Passwort</Label>
          <Input id="login-password" type="password" autoComplete="current-password" />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground gap-2 text-xs font-normal">
            <Checkbox defaultChecked />
            Angemeldet bleiben
          </Label>
          <Link to="/passwort-vergessen" className="text-primary text-xs hover:underline">
            Passwort vergessen?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full">
          Anmelden
        </Button>
      </form>

      <Separator />

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        Konten werden ausschließlich von einem Admin deines Unternehmens angelegt.
        <br />
        Eine Selbstregistrierung gibt es nicht.
      </p>
    </AuthSplit>
  )
}
