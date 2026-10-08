// Placeholder data until GET /stats exists. Everything here is invented.

import { storedAnalyses, type AnalysisListItem } from "@/mocks/analyses"

/**
 * Finished analyses by their verdict. A decision of an analyst counts over the
 * detection, suspicious only comes from the detection.
 */
export type VerdictCounts = {
  phishing: number
  suspicious: number
  clean: number
  /** Finished without a score and nobody has decided yet. */
  unrated: number
}

export type DayCounts = VerdictCounts & {
  /** Calendar day in the browser's timezone, YYYY-MM-DD. */
  day: string
}

export type OpenItem = Pick<
  AnalysisListItem,
  "id" | "subject" | "sender" | "status" | "verdict" | "score" | "receivedAt"
>

export type DomainCount = {
  domain: string
  count: number
}

export type Stats = {
  counts: VerdictCounts
  /** The same span right before, for the trend. */
  previous: VerdictCounts
  /** One entry per calendar day of the period, oldest first. */
  daily: DayCounts[]
  /** Finished without a decision, whatever the period. */
  open: { total: number; items: OpenItem[] }
  /** Decisions in the period, the base of the two numbers below. */
  decided: number
  /** Share of phishing or suspicious verdicts set back to clean, null without decisions. */
  falsePositiveRate: number | null
  /** Median minutes from receipt to decision, null without decisions. */
  medianDecisionMinutes: number | null
  /** Sender domains of phishing, most frequent first. */
  topDomains: DomainCount[]
  sources: { upload: number; report: number }
}

// The same day always gets the same numbers, so the last 7 days look alike
// in both periods and after a reload.
function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function localDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function dayCounts(teamSeed: number, daysAgo: number, now: Date): DayCounts {
  const date = new Date(now)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)

  // fewer mails on weekends
  const weekend = date.getDay() === 0 || date.getDay() === 6
  const scale = weekend ? 0.35 : 1
  const seed = teamSeed * 1000 + Math.floor(date.getTime() / 86_400_000)
  const pick = (offset: number, max: number) =>
    Math.round(noise(seed + offset) * max * scale)

  return {
    day: localDay(date),
    phishing: pick(1, 6),
    suspicious: pick(2, 4),
    clean: pick(3, 9),
    unrated: pick(4, 2),
  }
}

function sum(days: DayCounts[]): VerdictCounts {
  return days.reduce(
    (total, day) => ({
      phishing: total.phishing + day.phishing,
      suspicious: total.suspicious + day.suspicious,
      clean: total.clean + day.clean,
      unrated: total.unrated + day.unrated,
    }),
    { phishing: 0, suspicious: 0, clean: 0, unrated: 0 }
  )
}

const domains = [
  "dhl-versand-tracking.top",
  "rnicrosoft-login.com",
  "hansa-iogistik.de",
  "paket-status.top",
  "sparkasse-sicherheit.info",
]

export function mockStats(
  teamId: string,
  days: number,
  now = new Date()
): Stats {
  const teamSeed = teamId === "soc" ? 2 : 1

  const daily = Array.from({ length: days }, (_, index) =>
    dayCounts(teamSeed, days - 1 - index, now)
  )
  const before = Array.from({ length: days }, (_, index) =>
    dayCounts(teamSeed, 2 * days - 1 - index, now)
  )
  const counts = sum(daily)
  const total =
    counts.phishing + counts.suspicious + counts.clean + counts.unrated

  // the work list comes from the placeholder analyses, so its links open
  const open = storedAnalyses(teamId)
    .filter((item) => item.status === "completed" && !item.decision)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  // spread the phishing count over the domains, the first one gets the most
  let left = counts.phishing
  const topDomains = domains
    .map((domain, index) => {
      const count = Math.min(left, Math.ceil(left / (2 - index * 0.2)))
      left -= count
      return { domain, count }
    })
    .filter((entry) => entry.count > 0)

  const decided = Math.round(total * 0.6)

  return {
    counts,
    previous: sum(before),
    daily,
    open: { total: open.length, items: open.slice(0, 5) },
    decided,
    falsePositiveRate:
      decided === 0 ? null : 0.05 + noise(teamSeed + days) * 0.08,
    medianDecisionMinutes:
      decided === 0 ? null : 35 + Math.round(noise(teamSeed * 7 + days) * 60),
    topDomains,
    sources: {
      report: Math.round(total * 0.35),
      upload: total - Math.round(total * 0.35),
    },
  }
}
