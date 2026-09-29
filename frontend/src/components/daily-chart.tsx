import { useState, type KeyboardEvent } from "react"

import { useWidth } from "@/hooks/use-width"
import { niceStep } from "@/lib/chart"
import { formatDay, formatWeekday } from "@/lib/format"
import type { DayCounts } from "@/mocks/stats"

const height = 200
const margin = { top: 12, right: 12, bottom: 26, left: 32 }

// Bottom to top. Phishing sits on the baseline, so its bars compare directly.
const series = [
  { key: "phishing", label: "Phishing", color: "var(--phishing)" },
  { key: "suspicious", label: "Verdächtig", color: "var(--suspicious)" },
  { key: "clean", label: "Sauber", color: "var(--clean)" },
  { key: "unrated", label: "Nicht bewertet", color: "var(--faint)" },
] as const

function totalOf(entry: DayCounts) {
  return series.reduce((sum, { key }) => sum + entry[key], 0)
}

/** Where each part of a day's bar starts and how tall it is. */
function stack(entry: DayCounts) {
  let bottom = 0

  return series.map((item) => {
    const start = bottom
    bottom += entry[item.key]
    return { ...item, start, value: entry[item.key] }
  })
}

/** Analyses per day, stacked by verdict. Expects the days oldest first. */
export function DailyChart({ data }: { data: DayCounts[] }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)

  const totals = data.map(totalOf)

  // Same root element as below, so the size observer stays attached.
  if (totals.every((total) => total === 0)) {
    return (
      <div ref={ref} className="grid place-items-center" style={{ height }}>
        <p className="text-sm text-muted-foreground">
          Keine Analysen in diesem Zeitraum.
        </p>
      </div>
    )
  }

  const last = data.length - 1
  const max = Math.max(1, ...totals)
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const ticks = Array.from(
    { length: top / step + 1 },
    (_, index) => index * step
  )

  const plotWidth = Math.max(0, width - margin.left - margin.right)
  const plotHeight = height - margin.top - margin.bottom
  const band = plotWidth / data.length
  const barWidth = Math.max(2, Math.min(28, band * 0.64))
  const center = (index: number) => margin.left + band * (index + 0.5)
  const y = (value: number) =>
    margin.top + plotHeight - (value / top) * plotHeight

  const middle = Math.floor(last / 2)
  const labels = [
    { index: 0, anchor: "start" },
    { index: middle, anchor: "middle" },
    { index: last, anchor: "end" },
  ] as const

  function pick(clientX: number, element: Element) {
    const offset = clientX - element.getBoundingClientRect().left - margin.left
    setActive(Math.min(last, Math.max(0, Math.floor(offset / band))))
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
    <div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Analysen pro Tag, höchstens ${max} an einem Tag`}
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
                  className="fill-faint font-mono text-[10.5px]"
                >
                  {tick}
                </text>
              </g>
            ))}

            {active !== null ? (
              <rect
                x={margin.left + band * active}
                y={margin.top}
                width={band}
                height={plotHeight}
                fill="var(--muted-foreground)"
                opacity={0.08}
              />
            ) : null}

            {data.map((entry, index) => (
              <g key={entry.day}>
                {stack(entry).map(({ key, color, start, value }) =>
                  value === 0 ? null : (
                    <rect
                      key={key}
                      x={center(index) - barWidth / 2}
                      y={y(start + value)}
                      width={barWidth}
                      height={y(start) - y(start + value)}
                      fill={color}
                      shapeRendering="crispEdges"
                    />
                  )
                )}
              </g>
            ))}

            {labels.map((label) => (
              <text
                key={label.index}
                x={
                  label.anchor === "start"
                    ? margin.left
                    : label.anchor === "end"
                      ? width - margin.right
                      : center(label.index)
                }
                y={height - 6}
                textAnchor={label.anchor}
                className="fill-faint font-mono text-[10.5px]"
              >
                {formatDay(data[label.index].day)}
              </text>
            ))}
          </svg>
        ) : null}

        {active !== null && hovered ? (
          <div
            className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 whitespace-nowrap shadow-md"
            style={{
              left: Math.min(Math.max(center(active), 80), width - 80),
              top: y(totals[active]) - 10,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="text-[13px] font-semibold">
              {formatWeekday(hovered.day)} · {totals[active]}{" "}
              {totals[active] === 1 ? "Analyse" : "Analysen"}
            </div>
            {series.map(({ key, label, color }) => (
              <div
                key={key}
                className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground"
              >
                <span
                  className="size-2 rounded-[2px]"
                  style={{ background: color }}
                />
                {label} {hovered[key]}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map(({ key, label, color }) => (
          <span
            key={key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-[3px]"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Analysen pro Tag nach Verdikt</caption>
        <thead>
          <tr>
            <th>Tag</th>
            {series.map(({ key, label }) => (
              <th key={key}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.day}>
              <td>{formatWeekday(entry.day)}</td>
              {series.map(({ key }) => (
                <td key={key}>{entry[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
