// Placeholder search until GET /analyses/search exists. It looks through the
// invented analyses the same way the API is meant to.

import {
  storedAnalyses,
  type AnalysisListItem,
  type StoredAnalysis,
} from "@/mocks/analyses"
import { mockIndicators } from "@/mocks/analysis-detail"

/** Where the query was found. Decides the group a hit is listed under. */
export type SearchField = "hash" | "sender" | "domain" | "subject"

export type SearchHit = Pick<
  AnalysisListItem,
  "id" | "subject" | "sender" | "status" | "verdict" | "receivedAt"
> & {
  field: SearchField
  /** The value that matched: the full hash, address, host or subject. */
  match: string
}

/** Hashes are only matched from this many characters on, shorter is guessing. */
export const hashPrefixLength = 8

export const searchLimit = 20

// One hit per analysis. If several fields match, the most specific one wins.
function matchOf(item: StoredAnalysis, needle: string) {
  const { hosts, hashes } = mockIndicators(item.id)

  const hash = hashes.find(
    (entry) => needle.length >= hashPrefixLength && entry.startsWith(needle)
  )
  if (hash) return { field: "hash" as const, match: hash }

  if (item.sender.toLowerCase().includes(needle)) {
    return { field: "sender" as const, match: item.sender }
  }

  const host = hosts.find((entry) => entry.includes(needle))
  if (host) return { field: "domain" as const, match: host }

  if (item.subject.toLowerCase().includes(needle)) {
    return { field: "subject" as const, match: item.subject }
  }

  return null
}

export function mockSearch(teamId: string, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase()

  return storedAnalyses(teamId)
    .flatMap((item) => {
      const found = matchOf(item, needle)
      if (!found) return []

      return [
        {
          id: item.id,
          subject: item.subject,
          sender: item.sender,
          status: item.status,
          verdict: item.verdict,
          receivedAt: item.receivedAt,
          ...found,
        },
      ]
    })
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, searchLimit)
}
