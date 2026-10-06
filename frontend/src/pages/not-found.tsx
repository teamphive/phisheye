import { Link } from "react-router"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-[8vh] flex max-w-[46ch] flex-col items-center gap-2 text-center">
      <span className="mb-1 text-5xl leading-none font-semibold tracking-tight text-faint">
        404
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">
        Seite nicht gefunden
      </h1>
      <p className="text-sm text-muted-foreground">
        Diese Adresse gibt es nicht. Möglicherweise wurde die Analyse gelöscht
        oder gehört zu einem Team, in dem du nicht bist.
      </p>
      <div className="mt-1.5 flex gap-2">
        <Link to="/" className={buttonVariants()}>
          Zur Übersicht
        </Link>
        <Link
          to="/analysen"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Alle Analysen
        </Link>
      </div>
    </div>
  )
}
