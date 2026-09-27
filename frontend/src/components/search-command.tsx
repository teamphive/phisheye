import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import {
  GlobeIcon,
  HashIcon,
  MailIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react"

import { useSession } from "@/components/session-provider"
import { VerdictBadge } from "@/components/verdict-badge"
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { searchAnalyses } from "@/lib/analyses"
import { errorMessage } from "@/lib/api"
import { shortenHash } from "@/lib/format"
import type { SearchField, SearchHit } from "@/mocks/search"

const minLength = 2

/** Waits for a pause in typing, so not every keystroke becomes a request. */
const debounceMs = 250

const groups: { field: SearchField; heading: string; icon: typeof MailIcon }[] =
  [
    { field: "subject", heading: "Betreff", icon: MailIcon },
    { field: "sender", heading: "Absender", icon: UserIcon },
    { field: "domain", heading: "Links", icon: GlobeIcon },
    { field: "hash", heading: "Anhang-Hashes", icon: HashIcon },
  ]

type SearchResult = {
  /** Team and query the answer belongs to. */
  key: string
  hits: SearchHit[] | null
  error: string | null
}

function HitLabel({ hit }: { hit: SearchHit }) {
  if (hit.field === "subject") {
    return (
      <>
        <span className="block truncate">{hit.subject}</span>
        <span className="block truncate font-mono text-[11px] text-faint">
          {hit.sender}
        </span>
      </>
    )
  }

  return (
    <>
      <span className="block truncate font-mono text-[13px]" title={hit.match}>
        {hit.field === "hash" ? shortenHash(hit.match) : hit.match}
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {hit.subject}
      </span>
    </>
  )
}

export function SearchCommand() {
  const navigate = useNavigate()
  const { activeTeam } = useSession()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<SearchResult | null>(null)

  const term = query.trim()
  const key = `${activeTeam.id}:${term}`
  const searching = term.length >= minLength
  const current = result?.key === key ? result : null
  const loading = searching && current === null

  // While the next answer is on its way the previous hits stay, so the list
  // does not flicker with every keystroke.
  const shown =
    current ??
    (loading && result?.key.startsWith(`${activeTeam.id}:`) ? result : null)
  const hits = searching ? (shown?.hits ?? null) : null

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
        setQuery("")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (term.length < minLength) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchAnalyses(activeTeam.id, term, controller.signal).then(
        (found) => {
          if (!controller.signal.aborted) {
            setResult({ key, hits: found, error: null })
          }
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            setResult({ key, hits: null, error: errorMessage(error) })
          }
        }
      )
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [activeTeam.id, key, term])

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) setQuery("")
  }

  function select(hit: SearchHit) {
    changeOpen(false)
    navigate(`/analysen/${hit.id}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => changeOpen(true)}
        className="flex h-[34px] w-full max-w-[460px] items-center gap-2.5 rounded-md border border-border bg-card px-3 text-sm text-faint hover:border-input"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Absender, Domain, Hash oder Betreff suchen
        </span>
        <Kbd>⌘K</Kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        title="Suche"
        description={`Analysen im Team ${activeTeam.name} durchsuchen`}
        shouldFilter={false}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Absender, Domain, Hash oder Betreff suchen"
        />
        <CommandList>
          {!searching ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Mindestens {minLength} Zeichen eingeben. Gesucht wird in den
              Analysen von {activeTeam.name}.
            </p>
          ) : current?.error ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Die Suche ist fehlgeschlagen. {current.error}
            </p>
          ) : hits === null || (loading && hits.length === 0) ? (
            <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Spinner />
              Suche läuft …
            </p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Keine Treffer für „{term}“.
            </p>
          ) : null}

          {hits
            ? groups.map((group) => {
                const items = hits.filter((hit) => hit.field === group.field)
                if (items.length === 0) return null

                const Icon = group.icon

                return (
                  <CommandGroup key={group.field} heading={group.heading}>
                    {items.map((hit) => (
                      <CommandItem
                        key={hit.id}
                        value={hit.id}
                        onSelect={() => select(hit)}
                        className="gap-3"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <HitLabel hit={hit} />
                        </span>
                        <VerdictBadge
                          status={hit.status}
                          verdict={hit.verdict}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })
            : null}
        </CommandList>
      </CommandDialog>
    </>
  )
}
