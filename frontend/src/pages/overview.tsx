import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { CheckIcon, TriangleAlertIcon } from "lucide-react"

import { DailyChart } from "@/components/daily-chart"
import { PageHeader } from "@/components/page-header"
import { useSession } from "@/components/session-provider"
import { VerdictBadge } from "@/components/verdict-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { errorMessage } from "@/lib/api"
import {
  formatDelta,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "@/lib/format"
import { fetchStats, type Period } from "@/lib/stats"
import type { DomainCount, OpenItem, Stats, VerdictCounts } from "@/mocks/stats"

const periods: { value: Period; label: string }[] = [
  { value: 7, label: "7 Tage" },
  { value: 30, label: "30 Tage" },
]

// ?zeitraum=30 keeps the choice across a reload and in a shared link
function periodOf(value: string | null): Period {
  return value === "30" ? 30 : 7
}

const verdictTiles: {
  key: keyof VerdictCounts
  label: string
  tone: string
}[] = [
  { key: "phishing", label: "Phishing", tone: "bg-phishing" },
  { key: "suspicious", label: "Verdächtig", tone: "bg-suspicious" },
  { key: "clean", label: "Sauber", tone: "bg-clean" },
  { key: "unrated", label: "Nicht bewertet", tone: "bg-faint" },
]

export function OverviewPage() {
  const { activeTeam } = useSession()
  const [params, setParams] = useSearchParams()
  const period = periodOf(params.get("zeitraum"))

  return (
    <>
      <PageHeader
        title="Übersicht"
        description={`Team ${activeTeam.name}`}
        actions={
          <ToggleGroup
            value={[String(period)]}
            onValueChange={(value) => {
              // a click on the active entry would clear it, the period stays
              if (!value[0]) return
              setParams(value[0] === "7" ? {} : { zeitraum: value[0] }, {
                replace: true,
              })
            }}
            variant="outline"
            size="sm"
          >
            {periods.map((entry) => (
              <ToggleGroupItem key={entry.value} value={String(entry.value)}>
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      {/* another team, other numbers: remounting drops the old ones at once */}
      <Dashboard key={activeTeam.id} teamId={activeTeam.id} period={period} />
    </>
  )
}

function Dashboard({ teamId, period }: { teamId: string; period: Period }) {
  const [loaded, setLoaded] = useState<{
    period: Period
    stats: Stats
  } | null>(null)
  const [failure, setFailure] = useState<{
    period: Period
    error: unknown
  } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    fetchStats(teamId, period).then(
      (stats) => {
        if (active) setLoaded({ period, stats })
      },
      (error: unknown) => {
        if (active) setFailure({ period, error })
      }
    )

    return () => {
      active = false
    }
  }, [teamId, period, attempt])

  const error = failure?.period === period ? failure.error : null

  if (error) {
    return (
      <Card className="mx-auto mt-[4vh] max-w-[52ch]">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <TriangleAlertIcon className="size-6 text-phishing" />
          <div className="text-base font-semibold">
            Übersicht konnte nicht geladen werden
          </div>
          <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
          <Button
            variant="outline"
            onClick={() => {
              setFailure(null)
              setAttempt((current) => current + 1)
            }}
          >
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!loaded) return <DashboardSkeleton />

  // While the other period loads, the old numbers stay, only paler.
  const { stats } = loaded
  const days = loaded.period
  const stale = loaded.period !== period

  return (
    <div
      className={`flex flex-col gap-4 transition-opacity ${stale ? "opacity-60" : ""}`}
      aria-busy={stale}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {verdictTiles.map((tile) => (
          <CountTile
            key={tile.key}
            label={tile.label}
            tone={tile.tone}
            value={stats.counts[tile.key]}
            previous={stats.previous[tile.key]}
            days={days}
          />
        ))}
        <OpenTile total={stats.open.total} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Analysen pro Tag</CardTitle>
            <CardDescription className="text-xs">
              Letzte {days} Tage nach Verdikt, Entscheidungen zählen vor der
              Erkennung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DailyChart data={stats.daily} />
          </CardContent>
        </Card>

        <OpenCard items={stats.open.items} total={stats.open.total} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Falsch-positiv-Quote"
          description="Phishing- und Verdächtig-Verdikte, die ein Analyst als sauber eingestuft hat"
          value={
            stats.falsePositiveRate === null
              ? null
              : formatPercent(stats.falsePositiveRate)
          }
          hint={
            stats.decided === 1
              ? "bei 1 Entscheidung"
              : `bei ${formatNumber(stats.decided)} Entscheidungen`
          }
        />
        <MetricCard
          title="Bearbeitungszeit"
          description="Median vom Eingang bis zur Entscheidung"
          value={
            stats.medianDecisionMinutes === null
              ? null
              : formatDuration(stats.medianDecisionMinutes)
          }
          hint={`in den letzten ${days} Tagen`}
        />
        <SourcesCard sources={stats.sources} />
        <DomainsCard domains={stats.topDomains} />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Skeleton className="h-[330px] rounded-xl" />
        <Skeleton className="h-[330px] rounded-xl" />
      </div>
    </div>
  )
}

function TileLabel({ tone, children }: { tone: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className={`size-2 rounded-full ${tone}`} />
      {children}
    </span>
  )
}

function CountTile({
  label,
  tone,
  value,
  previous,
  days,
}: {
  label: string
  tone: string
  value: number
  previous: number
  days: Period
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5">
        <TileLabel tone={tone}>{label}</TileLabel>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatNumber(value)}
        </div>
        {/* no red or green: more phishing is not the team's fault */}
        <span className="text-xs text-muted-foreground">
          <span className="">{formatDelta(value - previous)}</span> zu den{" "}
          {days} Tagen davor
        </span>
      </CardContent>
    </Card>
  )
}

function OpenTile({ total }: { total: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5">
        <TileLabel tone="bg-primary">Zu prüfen</TileLabel>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatNumber(total)}
        </div>
        <span className="text-xs text-muted-foreground">
          ohne Entscheidung, aus jedem Zeitraum
        </span>
      </CardContent>
    </Card>
  )
}

function OpenCard({ items, total }: { items: OpenItem[]; total: number }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-sm">Zu prüfen</CardTitle>
        <CardDescription className="text-xs">
          {total > items.length
            ? `Die neuesten ${items.length} von ${formatNumber(total)} Mails ohne Entscheidung`
            : "Mails ohne Entscheidung, die neuesten zuerst"}
        </CardDescription>
        <CardAction>
          <Link
            to="/analysen"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Alle Analysen
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 px-(--card-spacing) py-3 text-sm text-muted-foreground">
            <CheckIcon className="size-4 text-clean" />
            Alles entschieden, nichts offen.
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              to={`/analysen/${item.id}`}
              className="flex items-center gap-3 border-b px-(--card-spacing) py-2.5 last:border-b-0 hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.subject}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.sender}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <VerdictBadge status={item.status} verdict={item.verdict} />
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(item.receivedAt)}
                </span>
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function MetricCard({
  title,
  description,
  value,
  hint,
}: {
  title: string
  description: string
  value: string | null
  hint: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">
          {value ?? "—"}
        </div>
        <span className="text-xs text-muted-foreground">
          {value === null ? "Noch keine Entscheidungen im Zeitraum" : hint}
        </span>
      </CardContent>
    </Card>
  )
}

function SourcesCard({ sources }: { sources: Stats["sources"] }) {
  const total = sources.upload + sources.report
  const reportShare = total === 0 ? 0 : sources.report / total

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Herkunft</CardTitle>
        <CardDescription className="text-xs">
          Aus Outlook gemeldet oder selbst hochgeladen
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Analysen im Zeitraum.
          </p>
        ) : (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
              <span
                className="bg-chart-1"
                style={{ width: `${reportShare * 100}%` }}
              />
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-1" />
                Outlook-Meldung
                <b className="font-medium">{formatNumber(sources.report)}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-secondary ring-1 ring-border" />
                Upload
                <b className="font-medium">{formatNumber(sources.upload)}</b>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DomainsCard({ domains }: { domains: DomainCount[] }) {
  const max = Math.max(1, ...domains.map((entry) => entry.count))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Häufigste Phishing-Absender</CardTitle>
        <CardDescription className="text-xs">
          Domains der Absender, mehrere Treffer deuten auf eine Kampagne
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kein Phishing im Zeitraum.
          </p>
        ) : (
          domains.map((entry) => (
            <div key={entry.domain} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{entry.domain}</span>
                <span className="font-medium tabular-nums">{entry.count}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-phishing/70"
                  style={{ width: `${(entry.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
