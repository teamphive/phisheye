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
