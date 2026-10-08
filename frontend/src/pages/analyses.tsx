import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import {
  CheckIcon,
  DownloadIcon,
  FlagIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { useSession } from "@/components/session-provider"
import { VerdictBadge } from "@/components/verdict-badge"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fetchAnalyses } from "@/lib/analyses"
import { errorMessage } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import {
  formatDateTime,
  formatRelativeTime,
  formatShortDateTime,
} from "@/lib/format"
import {
  verdictLabel,
  type AnalysisListItem,
  type AnalysisStatus,
} from "@/mocks/analyses"

const pageSize = 10

type Filter =
  | "all"
  | "phishing"
  | "suspicious"
  | "clean"
  | "unconfirmed"
  | "failed"
  | "mine"

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "phishing", label: "Phishing" },
  { value: "suspicious", label: "Verdächtig" },
  { value: "clean", label: "Legitim" },
  { value: "unconfirmed", label: "Nicht bestätigt" },
  { value: "failed", label: "Fehlgeschlagen" },
  { value: "mine", label: "Nur meine" },
]

// The analyst's decision outranks the detection, as in the stats
function shownVerdict(item: AnalysisListItem) {
  return item.decision?.verdict ?? item.verdict
}

// Done, but no analyst has confirmed or overruled the verdict yet
function unconfirmed(item: AnalysisListItem) {
  return item.status === "completed" && !item.decision
}

function matches(item: AnalysisListItem, filter: Filter, userName: string) {
  switch (filter) {
    case "all":
      return true
    case "unconfirmed":
      return unconfirmed(item)
    case "failed":
      return item.status === filter
    case "mine":
      return item.handler === userName
    default:
      return shownVerdict(item) === filter
  }
}

const statusLabel: Record<AnalysisStatus, string> = {
  running: "Läuft",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
}

/** Exports what the filter shows, across all pages, not only the current one. */
function exportAnalyses(items: AnalysisListItem[], teamName: string) {
  const team = teamName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  const today = new Date().toISOString().slice(0, 10)

  downloadCsv(`phisheye-analysen-${team}-${today}.csv`, [
    [
      "ID",
      "Betreff",
      "Absender",
      "Status",
      "Verdikt",
      "Bestätigt von",
      "Score",
      "Quelle",
      "Gemeldet von",
      "Bearbeiter",
      "Eingang",
    ],
    ...items.map((item) => {
      const verdict = shownVerdict(item)

      return [
        item.id,
        item.subject,
        item.sender,
        statusLabel[item.status],
        verdict ? verdictLabel[verdict] : null,
        item.decision?.by ?? null,
        item.score,
        item.source === "report" ? "Outlook-Meldung" : "Upload",
        item.reportedBy,
        item.handler,
        formatDateTime(item.receivedAt),
      ]
    }),
  ])

  toast.success(
    items.length === 1
      ? "1 Analyse exportiert"
      : `${items.length} Analysen exportiert`
  )
}

function rangeLabel(first: number, last: number, total: number) {
  if (total === 0) return "0 Einträge"
  if (total === 1) return "1 Eintrag"
  return `${first}–${last} von ${total} Einträgen`
}

export function AnalysesPage() {
  const { activeTeam } = useSession()

  // Another team is another list: remounting resets data, filter and page at once.
  return (
    <AnalysesList
      key={activeTeam.id}
      teamId={activeTeam.id}
      teamName={activeTeam.name}
    />
  )
}

function AnalysesList({
  teamId,
  teamName,
}: {
  teamId: string
  teamName: string
}) {
  const navigate = useNavigate()
  const { user, permissions } = useSession()
  const [items, setItems] = useState<AnalysisListItem[] | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchAnalyses(teamId).then(
      (data) => {
        if (active) setItems(data)
      },
      (error: unknown) => {
        if (active) setLoadError(errorMessage(error))
      }
    )
    return () => {
      active = false
    }
  }, [teamId])

  const visible = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()

    return items.filter((item) => {
      if (!matches(item, filter, user.name)) return false
      if (!needle) return true
      return (
        item.subject.toLowerCase().includes(needle) ||
        item.sender.toLowerCase().includes(needle)
      )
    })
  }, [items, filter, query, user.name])

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const offset = (currentPage - 1) * pageSize
  const pageItems = visible.slice(offset, offset + pageSize)

  return (
    <>
      <PageHeader
        title="Analysen"
        description={`Geteilte Historie im Team ${teamName}`}
        actions={
          <>
            <Button
              variant="outline"
              disabled={visible.length === 0}
              onClick={() => exportAnalyses(visible, teamName)}
            >
              <DownloadIcon className="size-4" />
              Exportieren
            </Button>
            {permissions.analyze ? (
              <Link to="/analysen/neu" className={buttonVariants()}>
                <PlusIcon className="size-4" />
                Neue Analyse
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            value={[filter]}
            onValueChange={(value) => {
              setFilter((value[0] as Filter) ?? "all")
              setPage(1)
            }}
            variant="outline"
            size="sm"
            // scrolls on its own instead of pushing the page wider
            className="max-w-full overflow-x-auto"
          >
            {filters.map((entry) => (
              <ToggleGroupItem key={entry.value} value={entry.value}>
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="relative w-[240px]">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Liste filtern"
              className="pl-8"
            />
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {loadError ? (
            <Alert variant="destructive" className="mx-6 w-auto">
              <AlertDescription>
                Die Analysen konnten nicht geladen werden. {loadError}
              </AlertDescription>
            </Alert>
          ) : items === null ? (
            <div className="flex flex-col">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 border-b border-border px-6 py-3.5 last:border-b-0"
                >
                  <Skeleton className="h-3.5 w-[46%]" />
                  <Skeleton className="h-2.5 w-[30%]" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailIcon />
                </EmptyMedia>
                <EmptyTitle>Keine Analysen</EmptyTitle>
                <EmptyDescription>
                  {permissions.analyze
                    ? "Für diese Auswahl gibt es keine Einträge. Andere Filter ausprobieren oder eine Mail hochladen."
                    : "Für diese Auswahl gibt es keine Einträge. Andere Filter ausprobieren."}
                </EmptyDescription>
              </EmptyHeader>
              {permissions.analyze ? (
                <EmptyContent>
                  <Link to="/analysen/neu" className={buttonVariants()}>
                    <PlusIcon className="size-4" />
                    Neue Analyse
                  </Link>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Betreff / Absender</TableHead>
                  <TableHead>Verdikt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Bearbeiter</TableHead>
                  <TableHead>Eingang</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item) => (
                  <TableRow
                    key={item.id}
                    onClick={() => navigate(`/analysen/${item.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <span className="block max-w-[380px] truncate font-semibold">
                        {item.subject}
                      </span>
                      <span className="block max-w-[380px] truncate text-xs text-muted-foreground">
                        {item.sender}
                      </span>
                    </TableCell>
                    <TableCell>
                      <VerdictBadge
                        status={item.status}
                        verdict={shownVerdict(item)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <ConfirmationStatus item={item} />
                    </TableCell>
                    <TableCell>
                      {item.source === "report" ? (
                        <>
                          <Badge variant="outline">
                            <FlagIcon />
                            Outlook
                          </Badge>
                          <span
                            className="mt-0.5 block max-w-[200px] truncate text-xs text-muted-foreground"
                            title={item.reportedBy ?? undefined}
                          >
                            {item.reportedBy}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Upload</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {item.handler ?? <span className="text-faint">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatShortDateTime(item.receivedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <CardFooter className="justify-between">
          <span className="text-xs text-muted-foreground">
            {loadError
              ? "Nicht geladen"
              : items === null
                ? "Wird geladen"
                : rangeLabel(
                    offset + 1,
                    offset + pageItems.length,
                    visible.length
                  )}
          </span>
          <div className="flex items-center gap-1.5">
            {pageCount > 1 ? (
              <span className="mr-1.5 text-xs text-muted-foreground">
                Seite {currentPage} von {pageCount}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Weiter
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  )
}

/** Whether an analyst has confirmed or overruled the verdict. */
function ConfirmationStatus({ item }: { item: AnalysisListItem }) {
  if (item.decision) {
    return (
      <Badge
        variant="outline"
        title={`von ${item.decision.by}, ${formatRelativeTime(item.decision.at)}`}
      >
        <CheckIcon />
        Bestätigt
      </Badge>
    )
  }

  if (unconfirmed(item)) {
    return <span className="text-muted-foreground">Nicht bestätigt</span>
  }

  // running or failed, there is nothing to confirm yet
  return <span className="text-faint">—</span>
}
