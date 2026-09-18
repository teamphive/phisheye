import { useEffect, useState, type FormEvent } from "react"
import { CopyIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { RemoveDomainDialog } from "@/components/remove-domain-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { ApiError, errorMessage } from "@/lib/api"
import { coveredBy, normalizeDomain } from "@/lib/domains"
import { formatDate } from "@/lib/format"
import {
  addReportDomain,
  fetchReportSettings,
  removeReportDomain,
} from "@/lib/team"
import type { ReportSettings } from "@/mocks/team"

type ReportDomainsCardProps = {
  teamId: string
  teamName: string
  /** Only admins add and remove domains, everyone else only reads. */
  isAdmin: boolean
}

/** Which domains' Outlook reports end up in this team. */
export function ReportDomainsCard({
  teamId,
  teamName,
  isAdmin,
}: ReportDomainsCardProps) {
  const [settings, setSettings] = useState<ReportSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [inputError, setInputError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchReportSettings(teamId).then(
      (data) => {
        if (active) setSettings(data)
      },
      (error: unknown) => {
        if (active) setLoadError(errorMessage(error))
      }
    )
    return () => {
      active = false
    }
  }, [teamId])

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!settings) return

    const domain = normalizeDomain(draft)
    if (!domain) {
      setInputError("Das ist keine gültige Domain. Beispiel: firma.de")
      return
    }

    const own = settings.domains.find((entry) =>
      coveredBy(domain, entry.domain)
    )
    if (own) {
      setInputError(
        own.domain === domain
          ? `${domain} ist schon eingetragen.`
          : `${domain} ist über ${own.domain} schon abgedeckt.`
      )
      return
    }

    setAdding(true)
    try {
      const entry = await addReportDomain(teamId, domain)
      setSettings(
        (current) =>
          current && { ...current, domains: [...current.domains, entry] }
      )
      setDraft("")
      toast.success(`${domain} hinzugefügt`)
    } catch (error) {
      // Which team has it stays hidden, teams do not see each other.
      setInputError(
        error instanceof ApiError && error.status === 409
          ? `${domain} überschneidet sich mit einer Domain, die ein anderes Team schon eingetragen hat.`
          : errorMessage(error)
      )
    } finally {
      setAdding(false)
    }
  }

  async function remove(id: string, domain: string) {
    setRemovingId(id)
    try {
      await removeReportDomain(teamId, id)
      setSettings(
        (current) =>
          current && {
            ...current,
            domains: current.domains.filter((entry) => entry.id !== id),
          }
      )
      toast.success(`${domain} entfernt`)
    } catch (error) {
      toast.error("Domain konnte nicht entfernt werden", {
        description: errorMessage(error),
      })
    } finally {
      setRemovingId(null)
    }
  }

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address)
      toast.success("Meldeadresse kopiert")
    } catch {
      toast.error("Kopieren hat nicht geklappt", {
        description: "Markier die Adresse und kopier sie von Hand.",
      })
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-sm">Outlook-Meldungen</CardTitle>
        <CardDescription className="text-xs">
          Melden Mitarbeiter eine Mail in Outlook, landet sie in diesem Team,
          wenn ihre Adresse zu einer dieser Domains gehört. Subdomains zählen
          mit.
        </CardDescription>
      </CardHeader>

      {loadError ? (
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Die Domains konnten nicht geladen werden. {loadError}
            </AlertDescription>
          </Alert>
        </CardContent>
      ) : settings === null ? (
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-[52px] rounded-lg" />
          <Skeleton className="h-4 w-[40%]" />
          <Skeleton className="h-4 w-[32%]" />
        </CardContent>
      ) : (
        <>
          <CardContent>
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  Outlook leitet Meldungen weiter an
                </div>
                <div className="truncate font-mono text-[13px] font-semibold">
                  {settings.reportAddress}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyAddress(settings.reportAddress)}
              >
                <CopyIcon className="size-3.5" />
                Kopieren
              </Button>
            </div>
          </CardContent>

          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-(--card-spacing)">Domain</TableHead>
                  <TableHead>Hinzugefügt</TableHead>
                  {isAdmin ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.domains.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 3 : 2}
                      className="px-(--card-spacing) whitespace-normal text-muted-foreground"
                    >
                      Noch keine Domain eingetragen. Bis dahin kommen keine
                      Outlook-Meldungen in diesem Team an.
                    </TableCell>
                  </TableRow>
                ) : null}
                {settings.domains.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-(--card-spacing) font-mono font-semibold">
                      {entry.domain}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.addedAt)} von {entry.addedBy}
                    </TableCell>
                    {isAdmin ? (
                      <TableCell className="pr-(--card-spacing) text-right">
                        <RemoveDomainDialog
                          domain={entry.domain}
                          teamName={teamName}
                          disabled={removingId === entry.id}
                          onConfirm={() => remove(entry.id, entry.domain)}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          <CardFooter>
            {isAdmin ? (
              <form onSubmit={add} noValidate className="w-full">
                <Field data-invalid={inputError ? true : undefined}>
                  <FieldLabel htmlFor="report-domain">
                    Domain hinzufügen
                  </FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="report-domain"
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value)
                        setInputError(null)
                      }}
                      placeholder="firma.de"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={adding}
                      aria-invalid={inputError ? true : undefined}
                      className="max-w-[320px] font-mono"
                    />
                    <Button type="submit" disabled={adding || !draft.trim()}>
                      {adding ? <Spinner /> : <PlusIcon className="size-4" />}
                      Hinzufügen
                    </Button>
                  </div>
                  {inputError ? (
                    <FieldError>{inputError}</FieldError>
                  ) : (
                    <FieldDescription className="text-xs">
                      Ohne @ und ohne www. Eine Domain gehört immer nur zu einem
                      Team.
                    </FieldDescription>
                  )}
                </Field>
              </form>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nur Admins können Domains hinzufügen oder entfernen.
              </p>
            )}
          </CardFooter>
        </>
      )}
    </Card>
  )
}
