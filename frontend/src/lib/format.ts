// The API sends ISO 8601 in UTC, the browser decides how it is shown.
const dateTime = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const date = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const shortDateTime = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const time = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
})

const relative = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" })

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso))
}

/** Date without a time, for things like a last-changed hint. */
export function formatDate(iso: string) {
  return date.format(new Date(iso))
}

export function formatShortDateTime(iso: string) {
  return shortDateTime.format(new Date(iso))
}

/** Time only, where the surrounding context already says which day. */
export function formatTime(iso: string) {
  return time.format(new Date(iso))
}

export function formatRelativeTime(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ]

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit)
    }
  }

  return relative.format(Math.round(seconds), "second")
}

/** The timezone the browser reports, shown where it matters. */
export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** File size for upload hints, one decimal from a megabyte upwards. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}

/** Up to two initials from a name, for avatars and team badges. */
export function initialsOf(name: string) {
  return name
    .split(/[\s\-_.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
}

/** Minutes and seconds since a point in time, for jobs that are waiting. */
export function formatElapsed(iso: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  )

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** A hash shortened in the middle, the full value belongs in a title. */
export function shortenHash(hash: string) {
  return hash.length > 20 ? `${hash.slice(0, 12)}…${hash.slice(-4)}` : hash
}

const whole = new Intl.NumberFormat("de-DE")

const oneDecimal = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Thousands separated the German way: 1.284 */
export function formatNumber(value: number) {
  return whole.format(value)
}

/** One decimal with a comma, the unit is left to the caller: 1,2 */
export function formatDecimal(value: number) {
  return oneDecimal.format(value)
}

/** A share between 0 and 1 as percent with one decimal: 8,3 % */
export function formatPercent(share: number) {
  return `${formatDecimal(share * 100)} %`
}

/** A change against an earlier value, with its sign: +8, −3, ±0 */
export function formatDelta(value: number) {
  if (value > 0) return `+${formatNumber(value)}`
  if (value < 0) return `−${formatNumber(-value)}`
  return "±0"
}

/** The two largest units of a duration in minutes: 2 Std 5 Min */
export function formatDuration(minutes: number) {
  const total = Math.round(minutes)
  if (total < 60) return `${total} Min`

  const hours = Math.floor(total / 60)
  if (hours < 24) {
    const rest = total % 60
    return rest ? `${hours} Std ${rest} Min` : `${hours} Std`
  }

  const days = Math.floor(hours / 24)
  const rest = hours % 24
  const label = days === 1 ? "1 Tag" : `${days} Tage`
  return rest ? `${label} ${rest} Std` : label
}

const dayMonth = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
})

const weekdayDayMonth = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

// A calendar day like 2026-09-23 is meant in the browser's timezone.
// new Date("2026-09-23") would be midnight UTC, here still the evening before.
function localDay(day: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(year, month - 1, date)
}

/** A calendar day as day and month: 23.09. */
export function formatDay(day: string) {
  return dayMonth.format(localDay(day))
}

/** A calendar day with its weekday: Mi., 23.09. */
export function formatWeekday(day: string) {
  return weekdayDayMonth.format(localDay(day))
}
