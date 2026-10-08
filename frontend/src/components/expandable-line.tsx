import { useState } from "react"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type ExpandableLineProps = {
  /** The whole value, shown once opened and as tooltip before. */
  value: string
  /** What the closed line shows, cut off at its end. Defaults to the value. */
  preview?: React.ReactNode
  className?: string
}

/**
 * One line of a long value, the rest one click away. Links and headers of a
 * mail can run to a thousand characters, wrapped they fill the screen.
 */
export function ExpandableLine({
  value,
  preview,
  className,
}: ExpandableLineProps) {
  const [open, setOpen] = useState(false)

  function toggle() {
    // selecting text to copy it is no click to open or close
    if (window.getSelection()?.toString()) return
    setOpen((current) => !current)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      title={open ? undefined : value}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        setOpen((current) => !current)
      }}
      className={cn(
        "flex min-w-0 items-start gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <ChevronRightIcon
        className={cn(
          "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-90"
        )}
      />
      {open ? (
        <span className="min-w-0 wrap-anywhere whitespace-pre-wrap">
          {value}
        </span>
      ) : (
        <span className="min-w-0 truncate">{preview ?? value}</span>
      )}
    </div>
  )
}
