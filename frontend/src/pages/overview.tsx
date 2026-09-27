import { PageHeader } from "@/components/page-header"
import { useSession } from "@/components/session-provider"

export function OverviewPage() {
  const { activeTeam } = useSession()

  return (
    <>
      <PageHeader
        title="Übersicht"
        description={`Team ${activeTeam.name} · Stand heute`}
      />
      <p className="text-sm text-muted-foreground">Inhalt folgt.</p>
    </>
  )
}
