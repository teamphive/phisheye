import { Link } from "react-router"

import { useSession } from "@/components/session-provider"
import { buttonVariants } from "@/components/ui/button"
import type { Permissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { roleLabel } from "@/mocks/session"

const reasons: Record<keyof Permissions, string> = {
  analyze: "Mails hochladen und Verdikte vergeben dürfen Analysten und Admins.",
  deleteAnalyses: "Analysen löschen dürfen nur Admins.",
  manageTeam: "Die Team-Verwaltung ist Admins vorbehalten.",
  monitor: "Das Monitoring ist Operatoren vorbehalten, unabhängig vom Team.",
}

/** Without a permission it stands for a 403 the API answered with. */
export function ForbiddenPage({
  permission,
}: {
  permission?: keyof Permissions
}) {
  const { activeTeam } = useSession()
  const isMonitor = permission === "monitor"

  return (
    <div className="mx-auto mt-[8vh] flex max-w-[46ch] flex-col items-center gap-2 text-center">
      <span className="text-phishing mb-1 font-mono text-[46px] leading-none font-semibold tracking-tight">
        403
      </span>
      <h1 className="text-[22px] font-semibold tracking-tight">Kein Zugriff</h1>
      <p className="text-muted-foreground text-sm">
        {permission ? reasons[permission] : "Dafür fehlt dir die Berechtigung."}{" "}
        {isMonitor ? null : (
          <>
            Deine Rolle im Team {activeTeam.name} ist{" "}
            <b className="text-foreground font-semibold">
              {roleLabel[activeTeam.role]}
            </b>
            .
          </>
        )}
      </p>
      <p className="text-faint text-xs">
        {isMonitor
          ? "Den Operator-Zugang vergibt, wer phisheye betreibt."
          : "Wenn du die Berechtigung brauchst, kann ein Admin deines Teams deine Rolle ändern."}
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
