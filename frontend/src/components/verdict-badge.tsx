import { Badge } from "@/components/ui/badge"
import type { AnalysisStatus, Verdict } from "@/mocks/analyses"

const verdictLabel: Record<Verdict, string> = {
  clean: "Sauber",
  suspicious: "Verdächtig",
  phishing: "Phishing",
}

type VerdictBadgeProps = {
  status: AnalysisStatus
  verdict: Verdict | null
}

export function VerdictBadge({ status, verdict }: VerdictBadgeProps) {
  if (status === "running") {
    return <Badge variant="secondary">Läuft</Badge>
  }

  if (status === "failed") {
    return <Badge variant="phishing">Fehlgeschlagen</Badge>
  }

  if (!verdict) {
    return <Badge variant="outline">Unbekannt</Badge>
  }

  return <Badge variant={verdict}>{verdictLabel[verdict]}</Badge>
}
