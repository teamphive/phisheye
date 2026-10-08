import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/keycloak", () => ({
  authEnabled: false,
  keycloak: { tokenParsed: undefined },
}))

const fetchMock = vi.fn<typeof fetch>()

// The base URL is read once when the module loads, so every test gets a fresh one
async function loadAnalyses() {
  vi.resetModules()
  return import("@/lib/analyses")
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

describe("with a backend", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://phisheye.test/api")
  })

  it("posts the verdict and returns the decision the server stored", async () => {
    const { decideAnalysis } = await loadAnalyses()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          verdict: "phishing",
          by: "Adrijus Lazdauskas",
          at: "2026-10-15T12:00:00Z",
        })
      )
    )

    const decision = await decideAnalysis("a-1", "phishing")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://phisheye.test/api/analyses/a-1/decision")
    expect(init?.method).toBe("POST")
    expect(init?.body).toBe(JSON.stringify({ verdict: "phishing" }))
    expect(decision).toEqual({
      verdict: "phishing",
      by: "Adrijus Lazdauskas",
      at: "2026-10-15T12:00:00Z",
    })
  })

  it("takes the analysis on and returns who has it now", async () => {
    const { claimAnalysis } = await loadAnalyses()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ handler: "Adrijus Lazdauskas" }))
    )

    const assignment = await claimAnalysis("a-1")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://phisheye.test/api/analyses/a-1/assignment")
    expect(init?.method).toBe("POST")
    expect(assignment).toEqual({ handler: "Adrijus Lazdauskas" })
  })

  it("keeps mine and the decision of every list item", async () => {
    const { fetchAnalyses } = await loadAnalyses()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "a-1",
            handler: "Anna",
            mine: true,
            decision: {
              verdict: "clean",
              by: "Anna",
              at: "2026-10-08T12:00:00",
            },
          },
        ])
      )
    )

    const [item] = await fetchAnalyses("itsec")

    expect(item.mine).toBe(true)
    expect(item.decision).toEqual({
      verdict: "clean",
      by: "Anna",
      at: "2026-10-08T12:00:00Z",
    })
  })

  it("words the assignment rules the backend answers with", async () => {
    const { caseErrorMessage, decideAnalysis } = await loadAnalyses()
    const answer = (status: number, detail: string) =>
      new Response(JSON.stringify({ detail }), { status })

    fetchMock.mockResolvedValueOnce(answer(409, "Take the analysis on first"))
    const nobody = await decideAnalysis("a-1", "phishing").catch(
      (error: unknown) => error
    )
    fetchMock.mockResolvedValueOnce(
      answer(403, "Only the assigned person can decide")
    )
    const someoneElse = await decideAnalysis("a-1", "phishing").catch(
      (error: unknown) => error
    )

    expect(caseErrorMessage("decide", nobody)).toBe(
      "Niemand hat die Analyse übernommen. Übernimm sie zuerst."
    )
    expect(caseErrorMessage("revoke", someoneElse)).toMatch(
      /Jemand anderes hat die Analyse inzwischen übernommen/
    )
    // on handing back, a conflict means it is decided already
    expect(caseErrorMessage("release", nobody)).toMatch(/schon entschieden/)
  })

  it("fetches the original mail through the backend", async () => {
    const { fetchEml } = await loadAnalyses()
    fetchMock.mockResolvedValue(new Response("Subject: Rechnung\r\n"))

    const file = await fetchEml("a-1")

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://phisheye.test/api/analyses/a-1/eml"
    )
    expect(await file.text()).toBe("Subject: Rechnung\r\n")
  })

  it.each([
    [
      "takes the decision back",
      "revokeDecision",
      "https://phisheye.test/api/analyses/a-1/decision",
    ],
    [
      "hands the analysis back",
      "releaseAnalysis",
      "https://phisheye.test/api/analyses/a-1/assignment",
    ],
    [
      "deletes the analysis",
      "deleteAnalysis",
      "https://phisheye.test/api/analyses/a-1",
    ],
  ] as const)("%s", async (_, name, url) => {
    const analyses = await loadAnalyses()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await analyses[name]("a-1")

    expect(fetchMock.mock.calls[0][0]).toBe(url)
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE")
  })
})
