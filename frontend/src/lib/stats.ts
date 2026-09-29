import { apiEnabled, apiFetch, mockLatency } from "@/lib/api"
import { browserTimeZone } from "@/lib/format"
import { mockStats, type Stats } from "@/mocks/stats"

export type Period = 7 | 30

/**
 * From midnight `days - 1` days ago up to now, both in the browser's timezone,
 * so today is one of the days. The browser decides where a day starts, the
 * backend stores UTC and would otherwise count the wrong midnight.
 */
export function periodRange(days: Period, now = new Date()) {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (days - 1))

  return { from: from.toISOString(), to: now.toISOString() }
}

/**
 * Numbers for the overview of the active team. The id only tells the
 * placeholder data which team to invent numbers for.
 */
export async function fetchStats(teamId: string, days: Period) {
  if (!apiEnabled) {
    await mockLatency(500)
    return mockStats(teamId, days)
  }

  const params = new URLSearchParams({
    ...periodRange(days),
    tz: browserTimeZone(),
  })

  return apiFetch<Stats>(`/stats?${params}`)
}
