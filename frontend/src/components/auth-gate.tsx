import { useEffect, useState, type ReactNode } from "react"
import { TriangleAlertIcon } from "lucide-react"

import { AuthBrand, AuthCard } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { initAuth, keycloakUrl } from "@/lib/keycloak"

type State = "pending" | "ready" | "failed"

/**
 * Nothing of the app renders before Keycloak has answered. Either the browser
 * is already on its way to the login page, or a token is there.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("pending")

  useEffect(() => {
    let active = true

    initAuth().then(
      () => {
        if (active) setState("ready")
      },
      (error: unknown) => {
        console.error("Keycloak konnte nicht erreicht werden.", error)
        if (active) setState("failed")
      }
    )

    return () => {
      active = false
    }
  }, [])

  if (state === "ready") return children

  if (state === "failed") {
    return (
      <AuthCard>
        <AuthBrand centered />

        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="grid size-[46px] place-items-center rounded-xl bg-phishing-soft text-phishing">
            <TriangleAlertIcon className="size-[22px]" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            Anmeldung nicht möglich
          </h1>
          <p className="max-w-[42ch] text-sm text-muted-foreground">
            Der Anmeldedienst unter{" "}
            <span className="text-xs">{keycloakUrl}</span> antwortet nicht.
            Läuft Keycloak?
          </p>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => window.location.reload()}
        >
          Erneut versuchen
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard width={340}>
      <AuthBrand centered />

      <div className="flex flex-col items-center gap-2.5 text-center">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm text-muted-foreground">
          Anmeldung wird geprüft …
        </p>
      </div>
    </AuthCard>
  )
}
