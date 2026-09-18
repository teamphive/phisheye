import { apiEnabled, apiFetch, mockLatency } from "@/lib/api"
import { mockAnalyses, type AnalysisListItem } from "@/mocks/analyses"
import {
  mockAnalysis,
  mockQueue,
  runningAnalysisId,
  type AnalysisDetail,
  type Queue,
} from "@/mocks/analysis-detail"
import { mockSearch, type SearchHit } from "@/mocks/search"

/**
 * The list of the active team. The backend knows that team from the session,
 * the id only tells the placeholder data which list to hand out.
 */
export async function fetchAnalyses(teamId: string) {
  if (!apiEnabled) {
    await mockLatency(700)
    return mockAnalyses(teamId)
  }

  return apiFetch<AnalysisListItem[]>("/analyses")
}

export async function fetchAnalysis(id: string) {
  if (!apiEnabled) {
    await mockLatency(500)
    return mockAnalysis(id)
  }

  return apiFetch<AnalysisDetail>(`/analyses/${encodeURIComponent(id)}`)
}

/** Waiting jobs and worker load, for the progress view of a running analysis. */
export async function fetchQueue() {
  if (!apiEnabled) {
    await mockLatency(300)
    return mockQueue()
  }

  return apiFetch<Queue>("/queue")
}

/**
 * Searches the active team's analyses by subject, sender, link host and
 * attachment hash. The signal cancels a request the next keystroke replaces.
 */
export async function searchAnalyses(
  teamId: string,
  query: string,
  signal?: AbortSignal
) {
  if (!apiEnabled) {
    await mockLatency(250)
    return mockSearch(teamId, query)
  }

  return apiFetch<SearchHit[]>(
    `/analyses/search?q=${encodeURIComponent(query)}`,
    { signal }
  )
}

/** Uploads the mail. The analysis itself runs as a background job. */
export async function createAnalysis(file: File) {
  if (!apiEnabled) {
    await mockLatency(600)
    return { id: runningAnalysisId }
  }

  const body = new FormData()
  body.append("file", file)

  return apiFetch<AnalysisListItem>("/analyses", { method: "POST", body })
}
