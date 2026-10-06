import { useState, type KeyboardEvent } from "react"

import { useWidth } from "@/hooks/use-width"
import { niceStep } from "@/lib/chart"
import { formatTime } from "@/lib/format"
import type { HourlyCount } from "@/mocks/monitoring"

const height = 180
const margin = { top: 12, right: 12, bottom: 26, left: 32 }
const hour = 60 * 60 * 1000

function dayHint(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return " heute"
  if (date.toDateString() === yesterday.toDateString()) return " gestern"
  return ""
}

/** Analyses per hour as an area chart. Expects the hours oldest first. */
export function HourlyChart({ data }: { data: HourlyCount[] }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)

  // Same root element as below, so the size observer stays attached once
  // data arrives.
  if (data.length < 2) {
    return (
      <div ref={ref} className="grid place-items-center" style={{ height }}>
        <p className="text-sm text-muted-foreground">
          Noch keine Daten für die letzten 24 Stunden.
        </p>
      </div>
    )
  }

  const last = data.length - 1
  const max = Math.max(1, ...data.map((entry) => entry.count))
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const ticks = Array.from(
    { length: top / step + 1 },
    (_, index) => index * step
  )

  const plotWidth = Math.max(0, width - margin.left - margin.right)
  const plotHeight = height - margin.top - margin.bottom
  const band = plotWidth / last
  const x = (index: number) => margin.left + index * band
  const y = (value: number) =>
    margin.top + plotHeight - (value / top) * plotHeight
  const baseline = y(0)

  const line = data
    .map(
      (entry, index) =>
        `${index === 0 ? "M" : "L"}${x(index)},${y(entry.count)}`
    )
    .join(" ")
  const area = `${line} L${x(last)},${baseline} L${x(0)},${baseline} Z`

  const peak = data.reduce(
    (best, entry, index) => (entry.count > data[best].count ? index : best),
    0
  )
  const middle = Math.floor(last / 2)
  const labels = [
    {
      index: 0,
      anchor: "start",
      text: formatTime(data[0].hour) + dayHint(data[0].hour),
    },
    { index: middle, anchor: "middle", text: formatTime(data[middle].hour) },
    {
      index: last,
      anchor: "end",
      text: formatTime(data[last].hour) + dayHint(data[last].hour),
    },
  ] as const

  function pick(clientX: number, element: Element) {
    const offset = clientX - element.getBoundingClientRect().left - margin.left
    setActive(Math.min(last, Math.max(0, Math.round(offset / band))))
  }

  function move(event: KeyboardEvent) {
    const current = active ?? last
    const next = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: last,
    }[event.key]

    if (next === undefined) return

    event.preventDefault()
    setActive(Math.min(last, Math.max(0, next)))
  }

  const hovered = active === null ? null : data[active]

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Analysen pro Stunde, Spitze ${data[peak].count} um ${formatTime(data[peak].hour)} Uhr`}
          tabIndex={0}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerMove={(event) => pick(event.clientX, event.currentTarget)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((current) => current ?? last)}
          onBlur={() => setActive(null)}
          onKeyDown={move}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={margin.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                {tick}
              </text>
            </g>
          ))}

          <path d={area} fill="var(--chart-1)" opacity={0.1} />
          <path
            d={line}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <circle
            cx={x(peak)}
            cy={y(data[peak].count)}
            r={4}
            fill="var(--chart-1)"
            stroke="var(--card)"
            strokeWidth={2}
          />

          {labels.map((label) => (
            <text
              key={label.index}
              x={x(label.index)}
              y={height - 6}
              textAnchor={label.anchor}
              className="fill-muted-foreground text-xs"
            >
              {label.text}
            </text>
          ))}

          {active !== null && hovered ? (
            <g pointerEvents="none">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={margin.top}
                y2={baseline}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                opacity={0.5}
              />
              <circle
                cx={x(active)}
                cy={y(hovered.count)}
                r={4}
                fill="var(--chart-1)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            </g>
          ) : null}
        </svg>
      ) : null}

      {active !== null && hovered ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 whitespace-nowrap shadow-md"
          style={{
            left: Math.min(Math.max(x(active), 64), width - 64),
            top: y(hovered.count) - 10,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="text-sm font-semibold">
            {hovered.count} {hovered.count === 1 ? "Analyse" : "Analysen"}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatTime(hovered.hour)}–
            {formatTime(
              new Date(new Date(hovered.hour).getTime() + hour).toISOString()
            )}{" "}
            Uhr
          </div>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>Analysen pro Stunde, letzte 24 Stunden</caption>
        <thead>
          <tr>
            <th>Stunde</th>
            <th>Analysen</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.hour}>
              <td>{formatTime(entry.hour)} Uhr</td>
              <td>{entry.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
