import { PageHeader } from "@/components/page-header"
import { useTeams } from "@/components/team-provider"

export function OverviewPage() {
  const { activeTeam } = useTeams()

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
