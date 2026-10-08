import { beforeEach, describe, expect, it, vi } from "vitest"

import { ForbiddenError } from "@/lib/api"

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

  it("decides only what one has taken on", async () => {
    const { claimAnalysis, decideAnalysis, fetchAnalyses } =
      await loadAnalyses()

    // nobody has it, then someone else has it
    await expect(decideAnalysis("a-2026-0132", "clean")).rejects.toMatchObject({
      status: 409,
    })
    await expect(
      decideAnalysis("a-2026-0131", "phishing")
    ).rejects.toBeInstanceOf(ForbiddenError)

    await claimAnalysis("a-2026-0132")
    const decision = await decideAnalysis("a-2026-0132", "clean")

    const item = (await fetchAnalyses("itsec")).find(
      (entry) => entry.id === "a-2026-0132"
    )
    expect(item?.decision).toEqual(decision)
  })

  it("takes back only a decision of one's own analysis", async () => {
    const { claimAnalysis, fetchAnalysis, revokeDecision } =
      await loadAnalyses()

    // decided by L. Brinkmann, who still has it
    await expect(revokeDecision("a-2026-0121")).rejects.toBeInstanceOf(
      ForbiddenError
    )

    // taking on works for a decided analysis too, then it is one's own
    await claimAnalysis("a-2026-0121")
    await revokeDecision("a-2026-0121")
    expect((await fetchAnalysis("a-2026-0121")).decision).toBeNull()
  })

  it("hands back only one's own undecided analysis", async () => {
    const { releaseAnalysis } = await loadAnalyses()

    await expect(releaseAnalysis("a-2026-0127")).rejects.toMatchObject({
      status: 409,
    })
    await expect(releaseAnalysis("a-2026-0131")).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })

  it("drops a deleted analysis from the team's list", async () => {
    const { deleteAnalysis, fetchAnalyses } = await loadAnalyses()
    const [first] = await fetchAnalyses("itsec")

    await deleteAnalysis(first.id)

    const remaining = await fetchAnalyses("itsec")
    expect(remaining.map((item) => item.id)).not.toContain(first.id)
  })
})
