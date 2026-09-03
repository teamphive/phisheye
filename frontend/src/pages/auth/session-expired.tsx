import { useNavigate } from "react-router"
import { ClockIcon } from "lucide-react"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"

export function SessionExpiredPage() {
  const navigate = useNavigate()

  return (
    <AuthCard>
      <AuthBrand centered />

      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="bg-suspicious-soft text-suspicious grid size-[46px] place-items-center rounded-xl">
          <ClockIcon className="size-[22px]" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Sitzung abgelaufen</h1>
        <p className="text-muted-foreground max-w-[42ch] text-sm">
          Aus Sicherheitsgründen wurdest du nach 30 Minuten ohne Aktivität
          abgemeldet. Nach der Anmeldung landest du wieder auf der Seite, auf der
          du warst.
        </p>
      </div>

      <Button size="lg" className="w-full" onClick={() => navigate("/login")}>
        Erneut anmelden
      </Button>
    </AuthCard>
  )
}
