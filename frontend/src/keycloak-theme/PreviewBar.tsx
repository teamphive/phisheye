import { cn } from "@/lib/utils"

function href(page: string, withError: boolean) {
  return `?page=${page}${withError ? "&error" : ""}`
}

/** Switches between the mocked pages of `npm run dev-keycloak-theme`. */
export function PreviewBar({
  pages,
  current,
  withError,
}: {
  pages: Record<string, string>
  current: string
  withError: boolean
}) {
  const item = "rounded-full px-3 py-1.5 whitespace-nowrap"

  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] gap-1 overflow-x-auto rounded-full border border-border bg-card/90 p-1 text-xs shadow-lg backdrop-blur">
      {Object.entries(pages).map(([id, label]) => (
        <a
          key={id}
          href={href(id, withError)}
          className={cn(
            item,
            id === current
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </a>
      ))}
      <a
        href={href(current, !withError)}
        className={cn(
          item,
          withError
            ? "bg-destructive/15 text-destructive"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Fehler {withError ? "an" : "aus"}
      </a>
    </nav>
  )
}
