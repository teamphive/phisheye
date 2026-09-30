import { useNavigate } from "react-router"
import { ClockIcon } from "lucide-react"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { authEnabled, login } from "@/lib/keycloak"

export function SessionExpiredPage() {
  const navigate = useNavigate()

  return (
    <AuthCard>
      <AuthBrand centered />

      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="grid size-[46px] place-items-center rounded-xl bg-suspicious-soft text-suspicious">
          <ClockIcon className="size-[22px]" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Sitzung abgelaufen
        </h1>
        <p className="max-w-[42ch] text-sm text-muted-foreground">
          Aus Sicherheitsgründen wurdest du nach 30 Minuten ohne Aktivität
          abgemeldet. Nach der Anmeldung landest du wieder auf der Seite, auf
          der du warst.
        </p>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          // Without Keycloak there is no login, the app simply opens again
          if (authEnabled) login()
          else navigate("/")
        }}
      >
        Erneut anmelden
      </Button>
    </AuthCard>
  )
}
