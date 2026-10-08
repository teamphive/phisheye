import {
  ApiError,
  ForbiddenError,
  apiBlob,
  apiEnabled,
  apiFetch,
  errorMessage,
  mockLatency,
} from "@/lib/api"
import { sessionUser } from "@/lib/session"
import {
  mockAnalyses,
  mockDeleteAnalysis,
  type AnalysisListItem,
} from "@/mocks/analyses"
import {
  mockAnalysis,
  mockAssign,
  mockDecide,
  mockEml,
  mockQueue,
  mockRelease,
  mockRevokeDecision,
  runningAnalysisId,
  type AnalysisDetail,
  type Assignment,
  type Decision,
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

/** The original mail as it was uploaded or reported, malware included. */
export async function fetchEml(id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockEml(id)
  }

  return apiBlob(`/analyses/${encodeURIComponent(id)}/eml`)
}

/** Confirms the verdict or reports it as a false positive. */
export async function decideAnalysis(id: string, verdict: Decision["verdict"]) {
  if (!apiEnabled) {
    await mockLatency()
    return mockDecide(id, verdict, sessionUser().name)
  }

  return apiFetch<Decision>(`/analyses/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verdict }),
  })
}

export async function revokeDecision(id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockRevokeDecision(id, sessionUser().name)
  }

  await apiFetch<void>(`/analyses/${encodeURIComponent(id)}/decision`, {
    method: "DELETE",
  })
}

/** Takes the analysis on, also away from someone else who had it. */
export async function claimAnalysis(id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockAssign(id, sessionUser().name)
  }

  return apiFetch<Assignment>(
    `/analyses/${encodeURIComponent(id)}/assignment`,
    { method: "POST" }
  )
}

/** Hands one's own analysis back, nobody has it afterwards. */
export async function releaseAnalysis(id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockRelease(id, sessionUser().name)
  }

  await apiFetch<void>(`/analyses/${encodeURIComponent(id)}/assignment`, {
    method: "DELETE",
  })
}

/** Soft delete for the whole team, only admins. */
export async function deleteAnalysis(id: string) {
  if (!apiEnabled) {
    await mockLatency()
    return mockDeleteAnalysis(id)
  }

  await apiFetch<void>(`/analyses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

export type CaseAction = "decide" | "revoke" | "claim" | "release"

/**
 * Words for the backend's assignment rules. Only the assigned person decides
 * or takes a decision back: nobody assigned is 409, someone else 403. A 409
 * on handing back means the analysis is decided already.
 */
export function caseErrorMessage(action: CaseAction, error: unknown) {
  const conflict = error instanceof ApiError && error.status === 409
  const forbidden = error instanceof ForbiddenError

  if (action === "decide" || action === "revoke") {
    if (conflict) {
      return "Niemand hat die Analyse übernommen. Übernimm sie zuerst."
    }
    if (forbidden) {
      return "Jemand anderes hat die Analyse inzwischen übernommen. Übernimm sie, um selbst zu entscheiden."
    }
  }

  if (action === "claim" && forbidden) {
    return "Mit der Rolle Audit kannst du keine Analysen übernehmen."
  }

  if (action === "release") {
    if (conflict) {
      return "Die Analyse ist schon entschieden. Nimm die Entscheidung zuerst zurück."
    }
    if (forbidden) {
      return "Jemand anderes hat die Analyse inzwischen übernommen."
    }
  }

  return errorMessage(error)
}

/** A rule was broken because the page is behind, a reload shows who has it now. */
export function isStaleCase(error: unknown) {
  return (
    error instanceof ForbiddenError ||
    (error instanceof ApiError && error.status === 409)
  )
}
