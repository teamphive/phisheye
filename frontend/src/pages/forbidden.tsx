import { Link } from "react-router"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ForbiddenPage() {
  return (
    <div className="mx-auto mt-[8vh] flex max-w-[46ch] flex-col items-center gap-2 text-center">
      <span className="text-phishing mb-1 font-mono text-[46px] leading-none font-semibold tracking-tight">
        403
      </span>
      <h1 className="text-[22px] font-semibold tracking-tight">Kein Zugriff</h1>
      <p className="text-muted-foreground text-sm">
        Diese Seite ist Admins vorbehalten. Deine Rolle im Team IT-Security ist{" "}
        <b className="text-foreground font-semibold">Analyst</b>.
      </p>
      <p className="text-faint text-xs">
        Wenn du die Berechtigung brauchst, kann ein Admin deines Teams deine
        Rolle ändern.
      </p>
      <div className="mt-1.5 flex gap-2">
        <Link to="/" className={buttonVariants()}>
          Zur Übersicht
        </Link>
        <Link to="/team" className={cn(buttonVariants({ variant: "outline" }))}>
          Team ansehen
        </Link>
      </div>
    </div>
  )
}
