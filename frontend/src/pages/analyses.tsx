import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { MailIcon, PlusIcon, SearchIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { VerdictBadge } from "@/components/verdict-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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
import { formatShortDateTime } from "@/lib/format"
import { fetchAnalyses, type AnalysisListItem } from "@/mocks/analyses"
import { currentUser } from "@/mocks/session"

type Filter = "all" | "phishing" | "suspicious" | "clean" | "running" | "failed" | "mine"

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "phishing", label: "Phishing" },
  { value: "suspicious", label: "Verdächtig" },
  { value: "clean", label: "Sauber" },
  { value: "running", label: "Läuft" },
  { value: "failed", label: "Fehlgeschlagen" },
  { value: "mine", label: "Nur meine" },
]

function matches(item: AnalysisListItem, filter: Filter) {
  switch (filter) {
    case "all":
      return true
    case "running":
    case "failed":
      return item.status === filter
    case "mine":
      return item.handler === currentUser.name
    default:
      return item.verdict === filter
  }
}

export function AnalysesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AnalysisListItem[] | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  useEffect(() => {
    let active = true
    fetchAnalyses().then((data) => {
      if (active) setItems(data)
    })
    return () => {
      active = false
    }
  }, [])

  const visible = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()

    return items.filter((item) => {
      if (!matches(item, filter)) return false
      if (!needle) return true
      return (
        item.subject.toLowerCase().includes(needle) ||
        item.sender.toLowerCase().includes(needle)
      )
    })
  }, [items, filter, query])

  return (
    <>
      <PageHeader
        title="Analysen"
        description="Geteilte Historie im Team IT-Security"
        actions={
          <>
            <Button variant="outline">Exportieren</Button>
            <Link to="/analysen/neu" className={buttonVariants()}>
              <PlusIcon className="size-4" />
              Neue Analyse
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            value={[filter]}
            onValueChange={(value) => setFilter((value[0] as Filter) ?? "all")}
            variant="outline"
            size="sm"
          >
            {filters.map((entry) => (
              <ToggleGroupItem key={entry.value} value={entry.value}>
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="relative w-[240px]">
            <SearchIcon className="text-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Liste filtern"
              className="pl-8"
            />
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {items === null ? (
            <div className="flex flex-col">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="border-border flex flex-col gap-2 border-b px-6 py-3.5 last:border-b-0"
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
                  Für diese Auswahl gibt es keine Einträge. Andere Filter
                  ausprobieren oder eine Mail hochladen.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link to="/analysen/neu" className={buttonVariants()}>
                  <PlusIcon className="size-4" />
                  Neue Analyse
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Betreff / Absender</TableHead>
                  <TableHead>Verdikt</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Bearbeiter</TableHead>
                  <TableHead>Eingang</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow
                    key={item.id}
                    onClick={() => navigate(`/analysen/${item.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <span className="block max-w-[380px] truncate font-semibold">
                        {item.subject}
                      </span>
                      <span className="text-faint block max-w-[380px] truncate font-mono text-xs">
                        {item.sender}
                      </span>
                    </TableCell>
                    <TableCell>
                      <VerdictBadge status={item.status} verdict={item.verdict} />
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {item.score === null ? (
                        <span className="text-faint">—</span>
                      ) : (
                        `${item.score} %`
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {item.handler}
                    </TableCell>
                    <TableCell className="text-faint font-mono whitespace-nowrap">
                      {formatShortDateTime(item.receivedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <CardFooter className="justify-between">
          <span className="text-faint font-mono text-[11.5px]">
            {items === null ? "Wird geladen" : `${visible.length} Einträge`}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled>
              Zurück
            </Button>
            <Button variant="outline" size="sm">
              Weiter
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  )
}
