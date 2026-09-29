import { useEffect, useState, type ReactNode } from "react"
import {
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { HourlyChart } from "@/components/hourly-chart"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { errorMessage, ForbiddenError } from "@/lib/api"
import {
  formatDecimal,
  formatNumber,
  formatShortDateTime,
  formatTime,
} from "@/lib/format"
import { fetchMonitoring, retryJob } from "@/lib/monitoring"
import type { FailedJob, Monitoring, ServiceHealth } from "@/mocks/monitoring"
import { ForbiddenPage } from "@/pages/forbidden"

const refreshInterval = 10_000

// Only the state, latencies over time are in Grafana
const serviceState = {
  ok: { variant: "clean", icon: CircleCheckIcon, label: "erreichbar" },
  degraded: {
    variant: "suspicious",
    icon: TriangleAlertIcon,
    label: "eingeschränkt",
  },
  down: { variant: "phishing", icon: CircleXIcon, label: "nicht erreichbar" },
} as const

export function MonitoringPage() {
  const [data, setData] = useState<Monitoring | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let received = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function load() {
      try {
        const next = await fetchMonitoring()
        if (!active) return

        received = true
        setData(next)
        setUpdatedAt(new Date().toISOString())
        setStale(false)
      } catch (loadError) {
        if (!active) return

        // Without a first answer, or without the right, there is nothing to
        // refresh. Otherwise the last values stay and are marked as old.
        if (!received || loadError instanceof ForbiddenError) {
          setError(loadError)
          return
        }

        setStale(true)
      }

      timer = setTimeout(load, refreshInterval)
    }

    load()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [attempt])

  if (error instanceof ForbiddenError)
    return <ForbiddenPage permission="monitor" />

  if (error) {
    return (
      <>
        <PageHeader
          title="Monitoring"
          description="Systemweit über alle Teams"
        />
        <Card className="mx-auto mt-[4vh] max-w-[52ch]">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <TriangleAlertIcon className="size-6 text-phishing" />
            <div className="text-[15px] font-semibold">
              Monitoring konnte nicht geladen werden
            </div>
            <p className="text-sm text-muted-foreground">
              {errorMessage(error)}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setError(null)
                setAttempt((current) => current + 1)
              }}
            >
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <PageHeader
          title="Monitoring"
          description="Systemweit über alle Teams"
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-4 h-[290px] rounded-xl" />
      </>
    )
  }

  const { queue, workers, jobs, virusTotal } = data
  const errorRate = jobs.total === 0 ? null : (jobs.failed / jobs.total) * 100

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Systemweit über alle Teams · Live-Werte, Aktualisierung alle 10 Sekunden"
        actions={
          <div className="flex flex-col items-end gap-1.5 self-center">
            <SystemState services={data.services} />
            {stale && updatedAt ? (
              <Badge variant="suspicious">
                <TriangleAlertIcon />
                Stand {formatTime(updatedAt)}, Aktualisierung fehlgeschlagen
              </Badge>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Warteschlange" value={formatNumber(queue.waiting)} />
        <StatTile
          label="Aktive Worker"
          value={formatNumber(workers.busy)}
          unit={`/ ${formatNumber(workers.total)}`}
        />
        <StatTile
          label="Fehlerrate (24 Std)"
          value={errorRate === null ? "—" : formatDecimal(errorRate)}
          unit={errorRate === null ? undefined : "%"}
        />
        <StatTile
          label="VirusTotal heute"
          value={formatNumber(virusTotal.used)}
          unit={`/ ${formatNumber(virusTotal.limit)}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Analysen pro Stunde</CardTitle>
            <CardDescription className="text-xs">
              Letzte 24 Stunden, alle Teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HourlyChart data={data.hourly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Dienste</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {data.services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between gap-3 border-b px-(--card-spacing) py-3 text-sm last:border-b-0"
              >
                <span>{service.name}</span>
                <ServiceBadge service={service} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <FailuresCard failures={data.failures} />
    </>
  )
}

function SystemState({ services }: { services: ServiceHealth[] }) {
  const down = services.filter((service) => service.status === "down").length

  if (down === 0) {
    return (
      <Badge variant="clean" className="h-6 px-2.5">
        <CircleCheckIcon />
        Alle Dienste erreichbar
      </Badge>
    )
  }

  return (
    <Badge variant="phishing" className="h-6 px-2.5">
      <CircleXIcon />
      {down === 1
        ? "1 Dienst nicht erreichbar"
        : `${down} Dienste nicht erreichbar`}
    </Badge>
  )
}

function StatTile({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5">
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-faint uppercase">
          {label}
        </span>
        <div className="text-[28px] leading-tight font-semibold tracking-tight">
          {value}
          {unit ? (
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function ServiceBadge({ service }: { service: ServiceHealth }) {
  const state = serviceState[service.status]
  const Icon = state.icon

  return (
    <Badge variant={state.variant}>
      <Icon />
      {state.label}
    </Badge>
  )
}

function FailuresCard({ failures }: { failures: FailedJob[] }) {
  const [retries, setRetries] = useState<
    Record<string, "pending" | "done" | undefined>
  >({})

  async function retry(id: string) {
    setRetries((current) => ({ ...current, [id]: "pending" }))

    try {
      await retryJob(id)
      setRetries((current) => ({ ...current, [id]: "done" }))
      toast.success("Job wurde wieder eingereiht")
    } catch (retryError) {
      setRetries((current) => ({ ...current, [id]: undefined }))
      toast.error("Neustart fehlgeschlagen", {
        description: errorMessage(retryError),
      })
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="border-b">
        <CardTitle className="text-sm">Letzte Fehler</CardTitle>
        <CardDescription className="text-xs">
          Fehlgeschlagene Jobs der letzten 24 Stunden, ohne Mailinhalte
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Zeit</TableHead>
              <TableHead>Fehler</TableHead>
              <TableHead>Versuche</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {failures.length === 0 ? (
              <EmptyRow>
                Keine fehlgeschlagenen Jobs in den letzten 24 Stunden.
              </EmptyRow>
            ) : null}
            {failures.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="pl-(--card-spacing) font-mono">
                  {formatShortDateTime(job.at)}
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {job.error}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {job.attempt} / {job.maxAttempts}
                </TableCell>
                <TableCell className="pr-(--card-spacing) text-right">
                  <RetryButton
                    state={retries[job.id]}
                    onClick={() => retry(job.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RetryButton({
  state,
  onClick,
}: {
  state: "pending" | "done" | undefined
  onClick: () => void
}) {
  if (state === "done") {
    return (
      <Button variant="outline" size="sm" disabled>
        <CheckIcon />
        Eingereiht
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={state === "pending"}
      onClick={onClick}
    >
      {state === "pending" ? <Spinner /> : null}
      Neu starten
    </Button>
  )
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell
        colSpan={4}
        className="px-(--card-spacing) text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  )
}
