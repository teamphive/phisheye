import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockStats } from "@/mocks/stats"

vi.mock("@/lib/keycloak", () => ({
  authEnabled: false,
  keycloak: { tokenParsed: undefined },
}))

const fetchMock = vi.fn<typeof fetch>()

// The base URL is read once when the module loads, so every test gets a fresh one
async function loadStats() {
  vi.resetModules()
  return import("@/lib/stats")
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-15T09:30:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

// The config pins the timezone to UTC, so local midnight is 00:00Z here.
describe("periodRange", () => {
  it("starts at midnight so that today is the last of the days", async () => {
    const { periodRange } = await loadStats()

    expect(periodRange(7)).toEqual({
      from: "2026-10-09T00:00:00.000Z",
      to: "2026-10-15T09:30:00.000Z",
    })
    expect(periodRange(30).from).toBe("2026-09-16T00:00:00.000Z")
  })
})

describe("with a backend", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://phisheye.test/api")
  })

  it("asks for the period and the timezone the days are counted in", async () => {
    const { fetchStats } = await loadStats()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({})))

    await fetchStats("itsec", 7)

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe("/api/stats")
    expect(url.searchParams.get("from")).toBe("2026-10-09T00:00:00.000Z")
    expect(url.searchParams.get("to")).toBe("2026-10-15T09:30:00.000Z")
    expect(url.searchParams.get("tz")).toBe("UTC")
  })
})

describe("placeholder numbers", () => {
  it("add up: the totals are the sum of the days", () => {
    const stats = mockStats("itsec", 30)

    expect(stats.daily).toHaveLength(30)
    expect(stats.daily.at(-1)?.day).toBe("2026-10-15")
    for (const key of ["phishing", "suspicious", "clean", "unrated"] as const) {
      expect(stats.counts[key]).toBe(
        stats.daily.reduce((total, day) => total + day[key], 0)
      )
    }
  })

  it("give the last 7 days the same numbers in both periods", () => {
    const week = mockStats("itsec", 7).daily
    const month = mockStats("itsec", 30).daily.slice(-7)

    expect(month).toEqual(week)
  })
})
