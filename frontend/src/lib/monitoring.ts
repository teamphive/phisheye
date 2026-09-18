import { apiEnabled, apiFetch, mockLatency } from "@/lib/api"
import { mockMonitoring, type Monitoring } from "@/mocks/monitoring"

/** System-wide values across all teams, only for operators. */
export async function fetchMonitoring() {
  if (!apiEnabled) {
    await mockLatency(500)
    return mockMonitoring()
  }

  return apiFetch<Monitoring>("/monitoring")
}

/** Puts a failed job back into the queue. */
export async function retryJob(id: string) {
  if (!apiEnabled) return mockLatency()

  await apiFetch<void>(`/monitoring/jobs/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  })
}
