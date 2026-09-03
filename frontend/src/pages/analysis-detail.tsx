import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { CheckIcon, Loader2Icon, TrashIcon, TriangleAlertIcon } from "lucide-react"

import { ScoreMeter } from "@/components/score-meter"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import {
  fetchAnalysis,
  queue,
  type AnalysisDetail,
  type Decision,
} from "@/mocks/analysis-detail"
import { currentUser } from "@/mocks/session"

export function AnalysisDetailPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<{ id: string; data: AnalysisDetail } | null>(null)
  const [override, setOverride] = useState<{ id: string; value: Decision | null } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetchAnalysis(id).then((data) => {
      if (active) setLoaded({ id, data })
    })
    return () => {
      active = false
    }
  }, [id])

  // derived instead of reset in the effect, so switching ids shows the skeleton again
  const analysis = loaded?.id === id ? loaded.data : null
  const decision = override?.id === id ? override.value : (analysis?.decision ?? null)

  function setDecision(value: Decision | null) {
    setOverride({ id, value })
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

  function decide(verdict: "phishing" | "clean") {
    setDecision({
      verdict,
      by: currentUser.name,
      at: new Date().toISOString(),
    })
  }

  return (
    <>
      <Breadcrumb className="mb-2.5">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/analysen" />}>Analysen</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono">#{analysis.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <h1 className="max-w-[60ch] text-xl font-semibold tracking-tight text-balance">
            {analysis.subject}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            <span className="font-mono">{analysis.sender}</span> · eingegangen am{" "}
            {formatDateTime(analysis.receivedAt)} · {analysis.handler}
          </p>
        </div>

        {analysis.status === "completed" ? (
          decision ? (
            <div className="bg-clean-soft text-clean border-clean/25 flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] font-semibold">
              <CheckIcon className="size-4" />
              {decision.verdict === "phishing"
                ? "Als Phishing bestätigt"
                : "Als falsch-positiv gemeldet"}{" "}
              von {decision.by} · {formatRelativeTime(decision.at)}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-auto px-2 py-0.5 text-xs"
                onClick={() => setDecision(null)}
              >
                Rückgängig
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => decide("clean")}>
                Falsch-positiv melden
              </Button>
              <Button onClick={() => decide("phishing")}>Als Phishing bestätigen</Button>
              <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                <TrashIcon className="size-4" />
                Löschen
              </Button>
            </div>
          )
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-4">
          {analysis.status === "running" ? <RunningCard analysis={analysis} /> : null}
          {analysis.status === "failed" ? <FailedCard analysis={analysis} /> : null}
          {analysis.status === "completed" ? <CompletedCards analysis={analysis} /> : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fall</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Row label="Status">
                {decision ? (
                  <Badge variant={decision.verdict === "phishing" ? "phishing" : "clean"}>
                    {decision.verdict === "phishing" ? "Bestätigt" : "Falsch-positiv"}
                  </Badge>
                ) : (
                  <VerdictBadge status={analysis.status} verdict={analysis.verdict} />
                )}
              </Row>
              <Row label="Zugewiesen">
                <span className="flex items-center gap-1.5">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">
                      {analysis.handler
                        .split(/[\s.]+/)
                        .filter(Boolean)
                        .map((part) => part.charAt(0))
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {analysis.handler}
                </span>
              </Row>
              <Row label="Analyse-ID">
                <span className="text-faint font-mono text-xs">#{analysis.id}</span>
              </Row>
              {analysis.durationSeconds !== null ? (
                <Row label="Dauer">
                  <span className="font-mono">{analysis.durationSeconds} Sek</span>
                </Row>
              ) : null}
            </CardContent>
          </Card>

          {analysis.status === "failed" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ursache beheben</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                <p className="text-muted-foreground text-xs">
                  Das VirusTotal-Kontingent setzt sich um 00:00 Uhr zurück. Der
                  aktuelle Stand steht im Monitoring.
                </p>
                <Button variant="outline" className="w-full" onClick={() => navigate("/monitoring")}>
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
            <AlertDialogAction onClick={() => navigate("/analysen")}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
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
            <span className="bg-accent text-primary grid size-8 shrink-0 place-items-center rounded-full">
              <Loader2Icon className="size-[18px] animate-spin" />
            </span>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">Analyse läuft</div>
              <p className="text-muted-foreground mt-0.5 text-[13px]">
                Aktueller Schritt: <b className="font-semibold">{analysis.step}</b>
              </p>
            </div>
            {analysis.startedAt ? (
              <span className="text-faint font-mono text-xs">
                {formatRelativeTime(analysis.startedAt)}
              </span>
            ) : null}
          </div>

          <div className="bg-secondary h-[7px] overflow-hidden rounded">
            <div className="bg-primary h-full w-2/5 animate-pulse rounded" />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              Du kannst die Seite verlassen — die Benachrichtigung kommt, sobald
              die Analyse fertig ist.
            </p>
            <Button variant="outline" size="sm">
              Abbrechen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-90">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-[13px]">Warteschlange</CardTitle>
            <p className="text-muted-foreground mt-0.5 text-[11.5px]">
              {queue.length} Mails warten auf einen freien Worker
            </p>
          </div>
          <Badge variant="outline">2 von 4 Workern belegt</Badge>
        </CardHeader>
        <CardContent className="px-0">
          {queue.map((item) => (
            <div
              key={item.position}
              className="border-border flex items-center gap-3 border-b px-6 py-2 last:border-b-0"
            >
              <span className="bg-secondary text-faint grid size-5 shrink-0 place-items-center rounded font-mono text-[10px] font-semibold">
                {item.position}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">
                  {item.subject}
                </span>
                <span className="text-faint block truncate font-mono text-[10.5px]">
                  {item.sender} · hochgeladen von {item.submittedBy}
                </span>
              </span>
              <span className="text-faint font-mono text-[10.5px]">
                wartet {item.waitingFor}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}

function FailedCard({ analysis }: { analysis: AnalysisDetail }) {
  if (!analysis.error) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-phishing-soft border-phishing/25 flex items-start gap-3 rounded-md border p-4">
          <TriangleAlertIcon className="text-phishing mt-0.5 size-[18px] shrink-0" />
          <div>
            <div className="text-[15px] font-semibold">Analyse fehlgeschlagen</div>
            <p className="text-muted-foreground mt-1 max-w-[56ch] text-[13px]">
              {analysis.error.detail}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Abgebrochen bei: {analysis.error.step}</Badge>
          <Badge variant="outline">
            Versuch {analysis.error.attempt} von {analysis.error.maxAttempts}
          </Badge>
          <Badge variant="outline">{formatDateTime(analysis.error.at)}</Badge>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Die bereits ermittelten Signale bleiben gespeichert. Beim erneuten
            Start wird nur der fehlgeschlagene Schritt wiederholt.
          </p>
          <Button size="sm">Erneut starten</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CompletedCards({ analysis }: { analysis: AnalysisDetail }) {
  const score = analysis.score ?? 0

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="text-phishing text-[56px] leading-none font-semibold tracking-tighter tabular-nums">
              {score}
              <span className="text-2xl font-medium"> %</span>
            </span>
            <div className="pt-1.5">
              <div className="flex items-center gap-2">
                <VerdictBadge status={analysis.status} verdict={analysis.verdict} />
                <Badge variant="outline">
                  {analysis.criteria.length} von {analysis.criteria.length} Kriterien ausgelöst
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1.5 max-w-[42ch] text-xs">
                Der Score ist die gewichtete Summe der ausgelösten Prüfungen. Ab{" "}
                {analysis.thresholds.phishing} % wird eine Mail als Phishing
                eingestuft.
              </p>
            </div>
          </div>

          <ScoreMeter score={score} thresholds={analysis.thresholds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Enthaltene Links ({analysis.links.length})</CardTitle>
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
              {analysis.links.map((link) => (
                <TableRow key={link.target}>
                  <TableCell>{link.text}</TableCell>
                  <TableCell className="font-mono">
                    <span className="block max-w-[26ch] truncate">{link.target}</span>
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
                <TableHead>Erkannter Typ</TableHead>
                <TableHead>SHA-256</TableHead>
                <TableHead>VirusTotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.attachments.map((file) => (
                <TableRow key={file.sha256}>
                  <TableCell>
                    <span className="block font-semibold">{file.filename}</span>
                    <span className="text-faint block font-mono text-[11px]">
                      {file.size}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={file.typeMismatch ? "suspicious" : "clean"}>
                      {file.detectedType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{file.sha256}</TableCell>
                  <TableCell>
                    <Badge variant={file.malicious ? "phishing" : "clean"}>
                      {file.virusTotal}
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
          <CardTitle className="text-sm">Ausgelöste Kriterien</CardTitle>
          <p className="text-muted-foreground text-xs">
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
              {analysis.criteria.map((criterion) => (
                <TableRow key={criterion.name}>
                  <TableCell className="font-semibold">{criterion.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono">
                    {criterion.finding}
                  </TableCell>
                  <TableCell className="text-phishing text-right font-mono font-semibold tabular-nums">
                    +{criterion.weight}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-secondary hover:bg-secondary">
                <TableCell colSpan={2} className="text-muted-foreground font-semibold">
                  Risiko-Score — Summe {analysis.criteriaTotal}, gekappt auf 100
                </TableCell>
                <TableCell className="text-phishing text-right font-mono text-sm font-bold tabular-nums">
                  {score}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Header (Auszug)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-secondary border-border text-muted-foreground overflow-x-auto rounded-md border p-4 font-mono text-[11.5px] leading-relaxed">
            {analysis.rawHeaders}
          </pre>
        </CardContent>
      </Card>
    </>
  )
}
