import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  CheckIcon,
  CircleHelpIcon,
  FlagIcon,
  Loader2Icon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ScoreMeter } from "@/components/score-meter"
import { useSession } from "@/components/session-provider"
import { VerdictBadge } from "@/components/verdict-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
import {
  decideAnalysis,
  deleteAnalysis,
  fetchAnalysis,
  fetchQueue,
  revokeDecision,
} from "@/lib/analyses"
import { ApiError, errorMessage } from "@/lib/api"
import {
  formatDateTime,
  formatElapsed,
  formatFileSize,
  formatRelativeTime,
  initialsOf,
  shortenHash,
} from "@/lib/format"
import {
  type AnalysisDetail,
  type Attachment,
  type Decision,
  type Queue,
} from "@/mocks/analysis-detail"
import { NotFoundPage } from "@/pages/not-found"

// How often a running analysis and the queue are asked again.
const pollInterval = 3000

const scoreTone = {
  clean: "text-clean",
  suspicious: "text-suspicious",
  phishing: "text-phishing",
}

// Without a score there is no verdict to confirm or dispute, the analyst
// classifies the mail from scratch.
const decisionText = {
  rated: {
    action: {
      phishing: "Als Phishing bestätigen",
      clean: "Falsch-positiv melden",
    },
    done: {
      phishing: "Als Phishing bestätigt",
      clean: "Als falsch-positiv gemeldet",
    },
    status: { phishing: "Bestätigt", clean: "Falsch-positiv" },
  },
  unrated: {
    action: {
      phishing: "Als Phishing einstufen",
      clean: "Als sauber einstufen",
    },
    done: {
      phishing: "Als Phishing eingestuft",
      clean: "Als sauber eingestuft",
    },
    status: { phishing: "Phishing", clean: "Sauber" },
  },
}

export function AnalysisDetailPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { permissions } = useSession()
  const [loaded, setLoaded] = useState<{
    id: string
    data: AnalysisDetail
  } | null>(null)
  const [failure, setFailure] = useState<{ id: string; error: unknown } | null>(
    null
  )
  const [attempt, setAttempt] = useState(0)
  const [override, setOverride] = useState<{
    id: string
    value: Decision | null
  } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState<"decide" | "revoke" | "delete" | null>(
    null
  )

  useEffect(() => {
    let active = true
    let received = false
    let timer: ReturnType<typeof setTimeout> | undefined

    // A running analysis is asked again until it is done, so the result
    // replaces the progress view without a reload.
    async function load() {
      try {
        const data = await fetchAnalysis(id)
        if (!active) return

        received = true
        setLoaded({ id, data })
        if (data.status === "running") timer = setTimeout(load, pollInterval)
      } catch (error) {
        if (!active) return

        // A failed poll keeps what is on screen and simply tries again.
        if (received) timer = setTimeout(load, pollInterval)
        else setFailure({ id, error })
      }
    }

    load()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [id, attempt])

  // derived instead of reset in the effect, so switching ids shows the skeleton again
  const analysis = loaded?.id === id ? loaded.data : null
  const error = failure?.id === id ? failure.error : null
  const decision =
    override?.id === id ? override.value : (analysis?.decision ?? null)

  function setDecision(value: Decision | null) {
    setOverride({ id, value })
  }

  if (!analysis && error) {
    if (error instanceof ApiError && error.status === 404)
      return <NotFoundPage />

    return (
      <Card className="mx-auto mt-[8vh] max-w-[52ch]">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <TriangleAlertIcon className="size-6 text-phishing" />
          <div className="text-[15px] font-semibold">
            Analyse konnte nicht geladen werden
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

  if (!analysis) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-[60%]" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  const text = decisionText[analysis.score === null ? "unrated" : "rated"]

  async function decide(verdict: Decision["verdict"]) {
    setPending("decide")
    try {
      setDecision(await decideAnalysis(id, verdict))
      toast.success(text.done[verdict])
    } catch (error) {
      toast.error("Entscheidung konnte nicht gespeichert werden", {
        description: errorMessage(error),
      })
    } finally {
      setPending(null)
    }
  }

  async function undo() {
    setPending("revoke")
    try {
      await revokeDecision(id)
      setDecision(null)
    } catch (error) {
      toast.error("Entscheidung konnte nicht zurückgenommen werden", {
        description: errorMessage(error),
      })
    } finally {
      setPending(null)
    }
  }

  async function remove() {
    setPending("delete")
    try {
      await deleteAnalysis(id)
      toast.success("Analyse gelöscht", {
        description: "Nach 10 Tagen wird sie endgültig entfernt.",
      })
      navigate("/analysen")
    } catch (error) {
      toast.error("Analyse konnte nicht gelöscht werden", {
        description: errorMessage(error),
      })
      setPending(null)
    }
  }

  return (
    <>
      <Breadcrumb className="mb-2.5">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/analysen" />}>
              Analysen
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono">
              #{analysis.id}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <h1 className="max-w-[60ch] text-xl font-semibold tracking-tight text-balance">
            {analysis.subject}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{analysis.sender}</span> · eingegangen
            am {formatDateTime(analysis.receivedAt)}
            {analysis.source === "report" ? (
              <>
                {" "}
                · gemeldet von{" "}
                <span className="font-mono">{analysis.reportedBy}</span>
              </>
            ) : null}
            {analysis.handler ? ` · ${analysis.handler}` : null}
          </p>
        </div>

        {analysis.status === "completed" ? (
          decision ? (
            <div className="flex shrink-0 items-center gap-2 rounded-md border border-clean/25 bg-clean-soft px-3 py-1.5 text-[13px] font-semibold text-clean">
              <CheckIcon className="size-4" />
              {text.done[decision.verdict]} von {decision.by} ·{" "}
              {formatRelativeTime(decision.at)}
              {permissions.analyze ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-auto px-2 py-0.5 text-xs"
                  disabled={pending !== null}
                  onClick={undo}
                >
                  {pending === "revoke" ? <Spinner /> : null}
                  Rückgängig
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex shrink-0 gap-2">
              {permissions.analyze ? (
                <>
                  <Button
                    variant="outline"
                    disabled={pending !== null}
                    onClick={() => decide("clean")}
                  >
                    {text.action.clean}
                  </Button>
                  <Button
                    disabled={pending !== null}
                    onClick={() => decide("phishing")}
                  >
                    {pending === "decide" ? <Spinner /> : null}
                    {text.action.phishing}
                  </Button>
                </>
              ) : null}
              {permissions.deleteAnalyses ? (
                <Button
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() => setDeleteOpen(true)}
                >
                  {pending === "delete" ? (
                    <Spinner />
                  ) : (
                    <TrashIcon className="size-4" />
                  )}
                  Löschen
                </Button>
              ) : null}
            </div>
          )
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-4">
          {analysis.status === "running" ? (
            <RunningCard analysis={analysis} />
          ) : null}
          {analysis.status === "failed" ? (
            <FailedCard analysis={analysis} />
          ) : null}
          {analysis.status === "completed" ? (
            <CompletedCards analysis={analysis} />
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fall</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Row label="Status">
                {decision ? (
                  <Badge
                    variant={
                      decision.verdict === "phishing" ? "phishing" : "clean"
                    }
                  >
                    {text.status[decision.verdict]}
                  </Badge>
                ) : (
                  <VerdictBadge
                    status={analysis.status}
                    verdict={analysis.verdict}
                  />
                )}
              </Row>
              <Row label="Quelle">
                {analysis.source === "report" ? (
                  <Badge variant="outline">
                    <FlagIcon />
                    Outlook-Meldung
                  </Badge>
                ) : (
                  <span>Upload</span>
                )}
              </Row>
              {analysis.source === "report" ? (
                <Row label="Gemeldet von">
                  <span
                    className="min-w-0 truncate font-mono text-xs"
                    title={analysis.reportedBy ?? undefined}
                  >
                    {analysis.reportedBy}
                  </span>
                </Row>
              ) : null}
              <Row label="Zugewiesen">
                {analysis.handler ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(analysis.handler)}
                      </AvatarFallback>
                    </Avatar>
                    {analysis.handler}
                  </span>
                ) : (
                  <span className="text-faint">Niemand</span>
                )}
              </Row>
              <Row label="Analyse-ID">
                <span className="font-mono text-xs text-faint">
                  #{analysis.id}
                </span>
              </Row>
              {analysis.durationSeconds !== null ? (
                <Row label="Dauer">
                  <span className="font-mono">
                    {analysis.durationSeconds} Sek
                  </span>
                </Row>
              ) : null}
            </CardContent>
          </Card>

          {analysis.status === "failed" && permissions.monitor ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ursache beheben</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                <p className="text-xs text-muted-foreground">
                  Das VirusTotal-Kontingent setzt sich um 00:00 Uhr zurück. Der
                  aktuelle Stand steht im Monitoring.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/monitoring")}
                >
                  Monitoring öffnen
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Analyse löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Die Analyse wird für das gesamte Team entfernt und nach 10 Tagen
              endgültig gelöscht. Nur Admins dürfen das.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// "unbekannt" is what the backend sends for a file VirusTotal never saw
function virusTotalTone(file: Attachment): "phishing" | "outline" | "clean" {
  if (file.malicious) return "phishing"
  return file.virusTotal === "unbekannt" ? "outline" : "clean"
}

function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number
  children: React.ReactNode
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function RunningCard({ analysis }: { analysis: AnalysisDetail }) {
  const { permissions } = useSession()

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
              <Loader2Icon className="size-[18px] animate-spin" />
            </span>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">Analyse läuft</div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Aktueller Schritt:{" "}
                <b className="font-semibold">
                  {analysis.step ?? "Wartet auf einen freien Worker"}
                </b>
              </p>
            </div>
            {analysis.startedAt ? (
              <span className="font-mono text-xs text-faint">
                {formatRelativeTime(analysis.startedAt)}
              </span>
            ) : null}
          </div>

          <div className="h-[7px] overflow-hidden rounded bg-secondary">
            <div className="h-full w-2/5 animate-pulse rounded bg-primary" />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Du kannst die Seite verlassen — die Benachrichtigung kommt, sobald
              die Analyse fertig ist.
            </p>
            {permissions.analyze ? (
              <Button variant="outline" size="sm">
                Abbrechen
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <QueueCard />
    </>
  )
}

function QueueCard() {
  const [queue, setQueue] = useState<Queue | null>(null)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function load() {
      try {
        const data = await fetchQueue()
        if (active) setQueue(data)
      } catch {
        // The queue is extra information, the last known state stays.
      }

      if (active) timer = setTimeout(load, pollInterval)
    }

    load()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  if (!queue) {
    return <Skeleton className="h-32 w-full" />
  }

  return (
    <Card className="opacity-90">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-[13px]">Warteschlange</CardTitle>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {queue.waiting === 0
              ? "Keine Mail wartet auf einen freien Worker"
              : queue.waiting === 1
                ? "1 Mail wartet auf einen freien Worker"
                : `${queue.waiting} Mails warten auf einen freien Worker`}
          </p>
        </div>
        <Badge variant="outline">
          {queue.workersBusy} von {queue.workersTotal} Workern belegt
        </Badge>
      </CardHeader>
      <CardContent className="px-0">
        {queue.items.map((item) => (
          <div
            key={item.position}
            className="flex items-center gap-3 border-b border-border px-6 py-2 last:border-b-0"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded bg-secondary font-mono text-[10px] font-semibold text-faint">
              {item.position}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">
                {item.subject}
              </span>
              <span className="block truncate font-mono text-[10.5px] text-faint">
                {item.sender} ·{" "}
                {item.source === "report" ? "gemeldet" : "hochgeladen"} von{" "}
                {item.submittedBy}
              </span>
            </span>
            <span className="font-mono text-[10.5px] text-faint">
              wartet {formatElapsed(item.queuedAt)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function FailedCard({ analysis }: { analysis: AnalysisDetail }) {
  const { permissions } = useSession()

  if (!analysis.error) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-md border border-phishing/25 bg-phishing-soft p-4">
          <TriangleAlertIcon className="mt-0.5 size-[18px] shrink-0 text-phishing" />
          <div>
            <div className="text-[15px] font-semibold">
              Analyse fehlgeschlagen
            </div>
            <p className="mt-1 max-w-[56ch] text-[13px] text-muted-foreground">
              {analysis.error.detail}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            Abgebrochen bei: {analysis.error.step}
          </Badge>
          <Badge variant="outline">
            Versuch {analysis.error.attempt} von {analysis.error.maxAttempts}
          </Badge>
          <Badge variant="outline">{formatDateTime(analysis.error.at)}</Badge>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Die bereits ermittelten Signale bleiben gespeichert. Beim erneuten
            Start wird nur der fehlgeschlagene Schritt wiederholt.
          </p>
          {permissions.analyze ? (
            <Button size="sm">Erneut starten</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function CompletedCards({ analysis }: { analysis: AnalysisDetail }) {
  // The detection can finish without a result, attachments and headers are
  // there all the same.
  const rated = analysis.score !== null
  const score = analysis.score ?? 0
  const tone = analysis.verdict
    ? scoreTone[analysis.verdict]
    : "text-foreground"
  // The API sends all checks, those that did not fire carry weight 0.
  const triggered = analysis.criteria.filter(
    (criterion) => criterion.weight > 0
  )

  return (
    <>
      {rated ? (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <span
                className={`${tone} text-[56px] leading-none font-semibold tracking-tighter`}
              >
                {score}
                <span className="text-2xl font-medium"> %</span>
              </span>
              <div className="pt-1.5">
                <div className="flex items-center gap-2">
                  <VerdictBadge
                    status={analysis.status}
                    verdict={analysis.verdict}
                  />
                  <Badge variant="outline">
                    {triggered.length} von {analysis.criteria.length} Kriterien
                    ausgelöst
                  </Badge>
                </div>
                <p className="mt-1.5 max-w-[42ch] text-xs text-muted-foreground">
                  Der Score ist die gewichtete Summe der ausgelösten Prüfungen.
                  Ab {analysis.thresholds.phishing} % wird eine Mail als
                  Phishing eingestuft.
                </p>
              </div>
            </div>

            <ScoreMeter score={score} thresholds={analysis.thresholds} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
              <CircleHelpIcon className="size-[18px]" />
            </span>
            <div>
              <div className="text-[15px] font-semibold">
                Noch nicht bewertet
              </div>
              <p className="mt-0.5 max-w-[56ch] text-[13px] text-muted-foreground">
                Die Erkennung hat für diese Mail keinen Score geliefert. Anhänge
                und Header stehen trotzdem unten.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Enthaltene Links ({analysis.links.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anzeigetext</TableHead>
                <TableHead>Tatsächliches Ziel</TableHead>
                <TableHead>Befund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.links.length === 0 ? (
                <EmptyRow colSpan={3}>
                  {rated
                    ? "Die Mail enthält keine Links."
                    : "Die Links werden erst mit der Bewertung ausgewertet."}
                </EmptyRow>
              ) : null}
              {analysis.links.map((link) => (
                <TableRow key={link.target}>
                  <TableCell>{link.text}</TableCell>
                  <TableCell className="font-mono">
                    <span className="block max-w-[26ch] truncate">
                      {link.target}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={link.tone}>{link.finding}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Anhänge ({analysis.attachments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datei</TableHead>
                <TableHead>SHA-256</TableHead>
                <TableHead>VirusTotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.attachments.length === 0 ? (
                <EmptyRow colSpan={3}>Die Mail hat keine Anhänge.</EmptyRow>
              ) : null}
              {analysis.attachments.map((file) => (
                <TableRow key={file.sha256}>
                  <TableCell>
                    <span className="block font-semibold">{file.filename}</span>
                    <span className="block font-mono text-[11px] text-faint">
                      {formatFileSize(file.size)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono" title={file.sha256}>
                    {shortenHash(file.sha256)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={virusTotalTone(file)}>
                      {file.virusTotal}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {rated ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ausgelöste Kriterien</CardTitle>
            <p className="text-xs text-muted-foreground">
              Jede Prüfung liefert Gewicht und Begründung
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kriterium</TableHead>
                  <TableHead>Befund</TableHead>
                  <TableHead className="text-right">Gewicht</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggered.length === 0 ? (
                  <EmptyRow colSpan={3}>
                    Keine Prüfung hat angeschlagen.
                  </EmptyRow>
                ) : null}
                {triggered.map((criterion) => (
                  <TableRow key={criterion.name}>
                    <TableCell className="font-semibold">
                      {criterion.name}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {criterion.finding}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-phishing tabular-nums">
                      +{criterion.weight}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-secondary hover:bg-secondary">
                  <TableCell
                    colSpan={2}
                    className="font-semibold text-muted-foreground"
                  >
                    Risiko-Score — Summe {analysis.criteriaTotal}, gekappt auf
                    100
                  </TableCell>
                  <TableCell
                    className={`${tone} text-right font-mono text-sm font-bold tabular-nums`}
                  >
                    {score}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Header (Auszug)</CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.rawHeaders ? (
            <pre className="overflow-x-auto rounded-md border border-border bg-secondary p-4 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
              {analysis.rawHeaders}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Zu dieser Mail sind keine Header gespeichert.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
