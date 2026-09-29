// Placeholder data until GET /monitoring exists. Everything here is invented.
// Times are ISO 8601 in UTC, exactly as the API will deliver them.

export type ServiceStatus = "ok" | "degraded" | "down"

export type ServiceHealth = {
  name: string
  status: ServiceStatus
}

/** A failed background job. Carries no mail content, only what went wrong. */
export type FailedJob = {
  id: string
  error: string
  attempt: number
  maxAttempts: number
  at: string
}

export type HourlyCount = {
  /** Start of the hour. */
  hour: string
  count: number
}

export type Monitoring = {
  queue: { waiting: number }
  workers: { busy: number; total: number }
  jobs: { failed: number; total: number }
  virusTotal: { used: number; limit: number }
  /** The last 24 hours across all teams, oldest first. */
  hourly: HourlyCount[]
  services: ServiceHealth[]
  failures: FailedJob[]
}

const hourlyCounts = [
  2, 1, 0, 1, 0, 2, 5, 9, 14, 18, 21, 17, 12, 15, 19, 22, 16, 11, 7, 5, 4, 3, 2,
  1,
]

const hour = 60 * 60 * 1000

export function mockMonitoring(): Monitoring {
  const now = new Date()

  const currentHour = new Date(now)
  currentHour.setMinutes(0, 0, 0)

  const hourly = hourlyCounts.map((count, index) => ({
    hour: new Date(
      currentHour.getTime() - (hourlyCounts.length - 1 - index) * hour
    ).toISOString(),
    count,
  }))

  return {
    queue: { waiting: 3 },
    workers: { busy: 2, total: 4 },
    jobs: {
      failed: 3,
      total: hourlyCounts.reduce((sum, count) => sum + count, 0),
    },
    virusTotal: { used: 412, limit: 500 },
    hourly,
    services: [
      { name: "API (FastAPI)", status: "ok" },
      { name: "PostgreSQL", status: "ok" },
      { name: "Redis", status: "ok" },
      { name: "VirusTotal-API", status: "degraded" },
    ],
    failures: [
      {
        id: "a2f19c",
        error: "VirusTotal-Kontingent überschritten (HTTP 429)",
        attempt: 3,
        maxAttempts: 3,
        at: new Date(now.getTime() - 2 * hour).toISOString(),
      },
      {
        id: "7bd410",
        error: "Mail konnte nicht geparst werden (defekte MIME-Struktur)",
        attempt: 1,
        maxAttempts: 3,
        at: new Date(now.getTime() - 11 * hour).toISOString(),
      },
    ],
  }
}
