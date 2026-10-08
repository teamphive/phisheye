import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  CheckIcon,
  CircleHelpIcon,
  DownloadIcon,
  FlagIcon,
  Loader2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  claimAnalysis,
  decideAnalysis,
  deleteAnalysis,
  fetchAnalysis,
  fetchEml,
  fetchQueue,
  releaseAnalysis,
  revokeDecision,
} from "@/lib/analyses"
import { ApiError, errorMessage } from "@/lib/api"
import { saveFile } from "@/lib/download"
import {
  formatDateTime,
  formatElapsed,
  formatFileSize,
  formatRelativeTime,
  initialsOf,
  shortenHash,
} from "@/lib/format"
import { verdictLabel, type Verdict } from "@/mocks/analyses"
import {
  type AiAssessment,
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

// Only for the display, after the three ranges in JEV's docs: below the
// first JEV is unsure, from the second on it decided clearly.
const unsureBelow = 0.5
const clearFrom = 0.8

const aiText = {
  phishing: {
    answer: "Ja, Phishing",
    tone: "text-phishing",
    icon: "bg-phishing-soft text-phishing",
  },
  clean: {
    answer: "Nein, kein Phishing",
    tone: "text-clean",
    icon: "bg-clean-soft text-clean",
  },
}

export function AnalysisDetailPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { permissions, user } = useSession()
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
  const [handlerOverride, setHandlerOverride] = useState<{
    id: string
    value: string | null
  } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [takeOverOpen, setTakeOverOpen] = useState(false)
  const [pending, setPending] = useState<
    "decide" | "revoke" | "delete" | "claim" | "release" | null
  >(null)

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

  const handler =
    handlerOverride?.id === id
      ? handlerOverride.value
      : (analysis?.handler ?? null)

  function setDecision(value: Decision | null) {
    setOverride({ id, value })
  }

  function setHandler(value: string | null) {
    setHandlerOverride({ id, value })
  }

  if (!analysis && error) {
    if (error instanceof ApiError && error.status === 404)
      return <NotFoundPage />

    return (
      <Card className="mx-auto mt-[8vh] max-w-[52ch]">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <TriangleAlertIcon className="size-6 text-phishing" />
          <div className="text-base font-semibold">
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
  // handler is the same name GET /me hands out
  const ownCase = handler !== null && handler === user.name

  async function decide(verdict: Decision["verdict"]) {
    setPending("decide")
    try {
      const stored = await decideAnalysis(id, verdict)
      setDecision(stored)
      // The backend assigns whoever decides, if nobody had taken it on
      if (!handler) setHandler(stored.by)
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

  async function claim() {
    setPending("claim")
    try {
      setHandler((await claimAnalysis(id)).handler)
    } catch (error) {
      toast.error("Analyse konnte nicht übernommen werden", {
        description: errorMessage(error),
      })
    } finally {
      setPending(null)
    }
  }

  function takeOn() {
    // Taking it away from someone else asks first
    if (handler) setTakeOverOpen(true)
    else claim()
  }

  async function release() {
    setPending("release")
    try {
      await releaseAnalysis(id)
      setHandler(null)
    } catch (error) {
      toast.error("Analyse konnte nicht abgegeben werden", {
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
            <BreadcrumbPage className="">#{analysis.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-[1_1_20rem]">
          <h1 className="max-w-[60ch] text-xl font-semibold tracking-tight text-balance">
            {analysis.subject}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="">{analysis.sender}</span> · eingegangen am{" "}
            {formatDateTime(analysis.receivedAt)}
            {analysis.source === "report" ? (
              <>
                {" "}
                · gemeldet von <span className="">{analysis.reportedBy}</span>
              </>
            ) : null}
            {handler ? ` · ${handler}` : null}
          </p>
        </div>

        {analysis.status === "completed" ? (
          decision ? (
            <div className="flex items-center gap-2 rounded-md border border-clean/25 bg-clean-soft px-3 py-1.5 text-sm font-semibold text-clean">
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
            <div className="flex flex-wrap gap-2">
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
                    className="min-w-0 truncate text-xs"
                    title={analysis.reportedBy ?? undefined}
                  >
                    {analysis.reportedBy}
                  </span>
                </Row>
              ) : null}
              <Row label="Zugewiesen">
                <span className="flex min-w-0 items-center gap-2">
                  {handler ? (
                    <Person name={handler} />
                  ) : (
                    <span className="text-faint">Niemand</span>
                  )}
                  {/* A decided case is closed, it keeps whoever had it */}
                  {permissions.analyze && !decision ? (
                    <Button
                      variant="outline"
                      size="xs"
                      className="shrink-0"
                      disabled={pending !== null}
                      onClick={ownCase ? release : takeOn}
                    >
                      {pending === "claim" || pending === "release" ? (
                        <Spinner />
                      ) : null}
                      {ownCase ? "Abgeben" : "Übernehmen"}
                    </Button>
                  ) : null}
                </span>
              </Row>
              {decision ? (
                <Row label="Bearbeitet von">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Person name={decision.by} />
                    <span className="shrink-0 text-muted-foreground">
                      · {formatRelativeTime(decision.at)}
                    </span>
                  </span>
                </Row>
              ) : null}
              <Row label="Analyse-ID">
                <span className="text-xs text-muted-foreground">
                  #{analysis.id}
                </span>
              </Row>
              {analysis.durationSeconds !== null ? (
                <Row label="Dauer">
                  <span className="">{analysis.durationSeconds} Sek</span>
                </Row>
              ) : null}
            </CardContent>
          </Card>

          {analysis.storageKey ? <OriginalMailCard id={id} /> : null}

          {analysis.status === "failed" && permissions.monitor ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ursache beheben</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                <p className="text-xs text-muted-foreground">
                  Fehlgeschlagene Jobs, Worker und das VirusTotal-Kontingent
                  stehen im Monitoring. Dort lässt sich der Job auch neu
                  einreihen.
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

      <AlertDialog open={takeOverOpen} onOpenChange={setTakeOverOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Analyse übernehmen</AlertDialogTitle>
            <AlertDialogDescription>
              {handler} bearbeitet diese Mail gerade. Wenn du sie übernimmst,
              ist sie nur noch dir zugewiesen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTakeOverOpen(false)
                claim()
              }}
            >
              Übernehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function OriginalMailCard({ id }: { id: string }) {
  const [downloading, setDownloading] = useState(false)

  async function download() {
    setDownloading(true)
    try {
      // Named after the id, a name taken from the mail could be anything
      saveFile(await fetchEml(id), `phisheye-${id}.eml`)
    } catch (error) {
      toast.error("Original-Mail konnte nicht geladen werden", {
        description: errorMessage(error),
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Original-Mail</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <p className="text-xs text-muted-foreground">
          Die Datei kann Schadcode enthalten. Nur in einer isolierten Umgebung
          öffnen, nie im eigenen Mailprogramm.
        </p>
        <Button
          variant="outline"
          className="w-full"
          disabled={downloading}
          onClick={download}
        >
          {downloading ? <Spinner /> : <DownloadIcon className="size-4" />}
          Mail herunterladen
        </Button>
      </CardContent>
    </Card>
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

function Person({ name }: { name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate" title={name}>
        {name}
      </span>
    </span>
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
  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
              <Loader2Icon className="size-[18px] animate-spin" />
            </span>
            <div className="flex-1">
              <div className="text-base font-semibold">Analyse läuft</div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Aktueller Schritt:{" "}
                <b className="font-semibold">
                  {analysis.step ?? "Wartet auf einen freien Worker"}
                </b>
              </p>
            </div>
            {analysis.startedAt ? (
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(analysis.startedAt)}
              </span>
            ) : null}
          </div>

          <div className="h-[7px] overflow-hidden rounded bg-secondary">
            <div className="h-full w-2/5 animate-pulse rounded bg-foreground/60" />
          </div>

          <Separator />

          {/* Cancelling waits for an endpoint, see docs/api.md */}
          <p className="text-xs text-muted-foreground">
            Du kannst die Seite verlassen, die Benachrichtigung kommt, sobald
            die Analyse fertig ist.
          </p>
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
          <CardTitle className="text-sm">Warteschlange</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
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
            <span className="grid size-5 shrink-0 place-items-center rounded bg-secondary text-[10px] font-semibold text-faint">
              {item.position}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                {item.subject}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.sender} ·{" "}
                {item.source === "report" ? "gemeldet" : "hochgeladen"} von{" "}
                {item.submittedBy}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              wartet {formatElapsed(item.queuedAt)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Starting it again waits for an endpoint, see docs/api.md. Operators can
// requeue the job in the monitoring already.
function FailedCard({ analysis }: { analysis: AnalysisDetail }) {
  if (!analysis.error) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-md border border-phishing/25 bg-phishing-soft p-4">
          <TriangleAlertIcon className="mt-0.5 size-[18px] shrink-0 text-phishing" />
          <div>
            <div className="text-base font-semibold">
              Analyse fehlgeschlagen
            </div>
            <p className="mt-1 max-w-[56ch] text-sm text-muted-foreground">
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
      </CardContent>
    </Card>
  )
}

function confidenceLabel(confidence: number) {
  if (confidence >= clearFrom) return "hoch"
  if (confidence >= unsureBelow) return "mittel"
  return "gering"
}

// How JEV's answer stands to the verdict of the rules
function agreement(ai: AiAssessment["verdict"], rules: Verdict | null) {
  if (!rules) return "Die Regeln haben keinen Score geliefert."
  if (rules === "suspicious")
    return "Die Regeln stufen die Mail als verdächtig ein."
  if (rules === ai) return "Deckt sich mit dem Verdikt der Regeln."
  return `Weicht von den Regeln ab, dort: ${verdictLabel[rules]}.`
}

function AiAssessmentCard({
  assessment,
  rulesVerdict,
}: {
  assessment: AiAssessment | null
  rulesVerdict: Verdict | null
}) {
  if (!assessment) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
            <SparklesIcon className="size-[18px]" />
          </span>
          <div>
            <div className="text-base font-semibold">Keine KI-Einschätzung</div>
            <p className="mt-0.5 max-w-[56ch] text-sm text-muted-foreground">
              JEV hat zu dieser Mail nicht geantwortet.
              {rulesVerdict
                ? " Das Verdikt stützt sich nur auf die Regeln."
                : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const text = aiText[assessment.verdict]
  const percent = Math.round(assessment.confidence * 100)
  const unsure = assessment.confidence < unsureBelow

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <SparklesIcon className="size-4 text-muted-foreground" />
          KI-Einschätzung
        </CardTitle>
        <CardDescription className="text-xs">
          JEV bewertet den Text der Mail, unabhängig von den Regeln
        </CardDescription>
        <CardAction>
          <span className="text-xs text-muted-foreground">
            {assessment.model}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${text.icon}`}
          >
            {assessment.verdict === "phishing" ? (
              <ShieldAlertIcon className="size-5" />
            ) : (
              <ShieldCheckIcon className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`text-lg font-semibold ${text.tone}`}>
              {text.answer}
            </div>
            <p className="text-sm text-muted-foreground">
              {agreement(assessment.verdict, rulesVerdict)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl leading-none font-semibold tabular-nums">
              {percent} %
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Konfidenz {confidenceLabel(assessment.confidence)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="h-[7px] overflow-hidden rounded bg-secondary">
            <div
              className={`h-full rounded ${unsure ? "bg-suspicious" : "bg-foreground"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Wie eindeutig sich JEV entschieden hat, nicht die Wahrscheinlichkeit
            für Phishing. Unter {unsureBelow * 100} % ist die Antwort unsicher,
            ab {clearFrom * 100} % eindeutig.
          </p>
        </div>

        {unsure ? (
          <div className="flex items-start gap-2 rounded-md border border-suspicious/25 bg-suspicious-soft p-3 text-sm">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-suspicious" />
            JEV ist sich bei dieser Mail nicht sicher. Die Einschätzung besser
            nicht als Grundlage für die Entscheidung nehmen.
          </div>
        ) : null}
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
                className={`${tone} text-5xl leading-none font-semibold tracking-tighter`}
              >
                {score}
                <span className="text-2xl font-medium"> %</span>
              </span>
              <div className="min-w-0 pt-1.5">
                <div className="flex flex-wrap items-center gap-2">
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
              <div className="text-base font-semibold">Noch nicht bewertet</div>
              <p className="mt-0.5 max-w-[56ch] text-sm text-muted-foreground">
                Die Erkennung hat für diese Mail keinen Score geliefert. Anhänge
                und Header stehen trotzdem unten.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AiAssessmentCard
        assessment={analysis.aiAssessment}
        rulesVerdict={analysis.verdict}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Enthaltene Links ({analysis.links.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {/* Fixed columns that wrap: long URLs never push the card sideways */}
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Anzeigetext</TableHead>
                <TableHead className="w-[40%]">Tatsächliches Ziel</TableHead>
                <TableHead className="w-[32%]">Befund</TableHead>
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
                  <TableCell className="wrap-anywhere whitespace-normal">
                    {link.text}
                  </TableCell>
                  <TableCell className="font-mono wrap-anywhere whitespace-normal">
                    {link.target}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <Badge
                      variant={link.tone}
                      className="h-auto max-w-full justify-start text-left wrap-anywhere whitespace-normal"
                    >
                      {link.finding}
                    </Badge>
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
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[46%]">Datei</TableHead>
                <TableHead className="w-[28%]">SHA-256</TableHead>
                <TableHead className="w-[26%]">VirusTotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.attachments.length === 0 ? (
                <EmptyRow colSpan={3}>Die Mail hat keine Anhänge.</EmptyRow>
              ) : null}
              {analysis.attachments.map((file) => (
                <TableRow key={file.sha256}>
                  <TableCell className="wrap-anywhere whitespace-normal">
                    <span className="block font-semibold">{file.filename}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </TableCell>
                  <TableCell
                    className="font-mono wrap-anywhere whitespace-normal"
                    title={file.sha256}
                  >
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36%]">Kriterium</TableHead>
                  <TableHead>Befund</TableHead>
                  <TableHead className="w-20 text-right">Gewicht</TableHead>
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
                    <TableCell className="font-semibold wrap-anywhere whitespace-normal">
                      {criterion.name}
                    </TableCell>
                    <TableCell className="wrap-anywhere whitespace-normal text-muted-foreground">
                      {criterion.finding}
                    </TableCell>
                    <TableCell className="text-right font-medium text-phishing tabular-nums">
                      +{criterion.weight}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-secondary hover:bg-secondary">
                  <TableCell
                    colSpan={2}
                    className="font-semibold whitespace-normal text-muted-foreground"
                  >
                    Risiko-Score, Summe {analysis.criteriaTotal}, gekappt auf
                    100
                  </TableCell>
                  <TableCell
                    className={`${tone} text-right text-sm font-bold tabular-nums`}
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
            <pre className="rounded-md border border-border bg-secondary p-4 font-mono text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap text-muted-foreground">
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
