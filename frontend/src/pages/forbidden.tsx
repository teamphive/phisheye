import { Link } from "react-router"

import { useSession } from "@/components/session-provider"
import { buttonVariants } from "@/components/ui/button"
import { teamRoleLabel } from "@/lib/instance"
import type { Permissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"

const reasons: Record<keyof Permissions, string> = {
  analyze: "Mails hochladen und Verdikte vergeben dürfen Analysten und Admins.",
  deleteAnalyses: "Analysen löschen dürfen nur Admins.",
  manageTeam: "Die Team-Verwaltung ist Admins vorbehalten.",
  monitor:
    "Das Monitoring ist dem Instanz-Admin vorbehalten, unabhängig vom Team.",
  createTeams: "Teams erstellen darf nur der Instanz-Admin.",
}

/** Without a permission it stands for a 403 the API answered with. */
export function ForbiddenPage({
  permission,
}: {
  permission?: keyof Permissions
}) {
  const { activeTeam } = useSession()
  // Both depend on the role in the default team, not on the active team
  const isInstanceMatter =
    permission === "monitor" || permission === "createTeams"

  return (
    <div className="mx-auto mt-[8vh] flex max-w-[46ch] flex-col items-center gap-2 text-center">
      <span className="mb-1 text-5xl leading-none font-semibold tracking-tight text-phishing">
        403
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Kein Zugriff</h1>
      <p className="text-sm text-muted-foreground">
        {permission ? reasons[permission] : "Dafür fehlt dir die Berechtigung."}{" "}
        {isInstanceMatter ? null : (
          <>
            Deine Rolle im Team {activeTeam.name} ist{" "}
            <b className="font-semibold text-foreground">
              {teamRoleLabel(activeTeam)}
            </b>
            .
          </>
        )}
      </p>
      <p className="text-xs text-faint">
        {isInstanceMatter
          ? "Instanz-Admin ist, wer im Standard-Team Admin ist."
          : activeTeam.viaInstance
            ? "Deine Instanz-Rolle ändert ein Admin des Standard-Teams."
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
