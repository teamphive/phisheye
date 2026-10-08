import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/keycloak", () => ({
  authEnabled: false,
  keycloak: { tokenParsed: undefined },
}))

// The placeholder server answers at once instead of after a pause
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  mockLatency: () => Promise.resolve(),
}))

const fetchMock = vi.fn<typeof fetch>()

// Fresh modules per test, so the placeholder data starts over
async function loadAnalyses() {
  vi.resetModules()
  return import("@/lib/analyses")
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  // No backend in this file: vi.resetModules() does not reset the mocked
  // @/lib/api, so the mode must not change between tests
  vi.stubEnv("VITE_API_URL", undefined)
})

describe("without a backend", () => {
  it("remembers a decision until it is taken back", async () => {
    const { decideAnalysis, fetchAnalysis, revokeDecision } =
      await loadAnalyses()

    const decision = await decideAnalysis("a-2026-0128", "clean")
    expect((await fetchAnalysis("a-2026-0128")).decision).toEqual(decision)

    await revokeDecision("a-2026-0128")
    expect((await fetchAnalysis("a-2026-0128")).decision).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("assigns and releases in the detail and in the list", async () => {
    const { claimAnalysis, fetchAnalyses, fetchAnalysis, releaseAnalysis } =
      await loadAnalyses()
    const handlerInList = async () =>
      (await fetchAnalyses("itsec")).find((item) => item.id === "a-2026-0132")
        ?.handler

    await claimAnalysis("a-2026-0132")
    expect((await fetchAnalysis("a-2026-0132")).handler).toBe("M. Sandmann")
    expect(await handlerInList()).toBe("M. Sandmann")

    await releaseAnalysis("a-2026-0132")
    expect((await fetchAnalysis("a-2026-0132")).handler).toBeNull()
    expect(await handlerInList()).toBeNull()
  })

  it("assigns whoever decides, unless someone has it already", async () => {
    const { decideAnalysis, fetchAnalysis } = await loadAnalyses()

    await decideAnalysis("a-2026-0132", "clean")
    expect((await fetchAnalysis("a-2026-0132")).handler).toBe("M. Sandmann")

    await decideAnalysis("a-2026-0131", "phishing")
    expect((await fetchAnalysis("a-2026-0131")).handler).toBe("T. Özdemir")
  })

  it("drops a deleted analysis from the team's list", async () => {
    const { deleteAnalysis, fetchAnalyses } = await loadAnalyses()
    const [first] = await fetchAnalyses("itsec")

    await deleteAnalysis(first.id)

    const remaining = await fetchAnalyses("itsec")
    expect(remaining.map((item) => item.id)).not.toContain(first.id)
  })
})
