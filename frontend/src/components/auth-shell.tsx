import type { ReactNode } from "react"

import { BrandMark } from "@/components/brand-mark"
import { Badge } from "@/components/ui/badge"

export function AuthBrand({ centered = false }: { centered?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 ${centered ? "justify-center" : ""}`}
    >
      <BrandMark className="text-primary size-7" />
      <span className="text-[19px] font-bold tracking-tight">phisheye</span>
    </div>
  )
}

/** Left column of the login page, shared with the Keycloak theme. */
export function LoginAside() {
  return (
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
  )
}

type AuthSplitProps = {
  aside: ReactNode
  children: ReactNode
}

/** Two column layout, used for login and registration. */
export function AuthSplit({ aside, children }: AuthSplitProps) {
  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <aside className="bg-muted border-border hidden flex-col justify-between border-r p-12 lg:flex">
        {aside}
      </aside>
      <div className="grid place-items-center px-10 py-12">
        <div className="flex w-full max-w-[360px] flex-col gap-[18px]">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Single centered column, used for everything else. */
export function AuthCard({
  children,
  width = 400,
}: {
  children: ReactNode
  width?: number
}) {
  return (
    <div className="grid min-h-svh place-items-center px-6 py-12">
      <div
        className="flex w-full flex-col gap-[18px]"
        style={{ maxWidth: `${width}px` }}
      >
        {children}
      </div>
    </div>
  )
}
