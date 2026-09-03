import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { GlobeIcon, HashIcon, MailIcon, SearchIcon, UserIcon } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"

// Placeholder results until the search endpoint exists.
const analyses = [
  "Ihre Rechnung RE-2024-88431 ist überfällig",
  "Zahlungsaufforderung – dringend, vertraulich",
  "Microsoft 365: Ihr Passwort läuft in 24 Stunden ab",
]
const domains = ["dhl-versand-tracking.top", "t.co-redirect.click"]
const senders = ["buchhaltung@dhl-versand-tracking.top"]
const hashes = ["9f2c1ab4e7d3…a41b"]

export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function openAnalysis() {
    setOpen(false)
    navigate("/analysen")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border bg-card text-faint hover:border-input flex h-[34px] w-full max-w-[460px] items-center gap-2.5 rounded-md border px-3 text-sm"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Absender, Domain, Hash oder Betreff suchen
        </span>
        <Kbd>⌘K</Kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Absender, Domain, Hash oder Betreff suchen" />
        <CommandList>
          <CommandEmpty>Keine Treffer.</CommandEmpty>

          <CommandGroup heading="Analysen">
            {analyses.map((item) => (
              <CommandItem key={item} onSelect={openAnalysis}>
                <MailIcon className="size-4" />
                {item}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Domains">
            {domains.map((item) => (
              <CommandItem key={item} onSelect={openAnalysis}>
                <GlobeIcon className="size-4" />
                {item}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Absender">
            {senders.map((item) => (
              <CommandItem key={item} onSelect={openAnalysis}>
                <UserIcon className="size-4" />
                {item}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Hashes">
            {hashes.map((item) => (
              <CommandItem key={item} onSelect={openAnalysis}>
                <HashIcon className="size-4" />
                {item}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
