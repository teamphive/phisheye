import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({
  enabled: false,
  keycloak: { token: "access-token", updateToken: vi.fn() },
}))

vi.mock("@/lib/keycloak", () => ({
  get authEnabled() {
    return auth.enabled
  },
  keycloak: auth.keycloak,
}))

const fetchMock = vi.fn<typeof fetch>()

// The base URL is read once when the module loads, so every test gets a fresh one
async function loadApi() {
  vi.resetModules()
  return import("@/lib/api")
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  auth.enabled = false
  auth.keycloak.updateToken.mockResolvedValue(true)
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("VITE_API_URL", "https://phisheye.test/api")
})

describe("apiEnabled", () => {
  it("is on once a backend URL is configured", async () => {
    const { apiEnabled } = await loadApi()

    expect(apiEnabled).toBe(true)
  })

  it("stays off without one, so the pages fall back to the mocks", async () => {
    vi.stubEnv("VITE_API_URL", undefined)
    const { apiEnabled } = await loadApi()

    expect(apiEnabled).toBe(false)
  })
})

describe("apiFetch", () => {
  it("calls the configured backend and keeps the request's own headers", async () => {
    const { apiFetch } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse({}))

    await apiFetch("/team/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://phisheye.test/api/team/domains")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toEqual({ "Content-Type": "application/json" })
  })

  it("turns snake_case keys into camelCase, also in nested lists", async () => {
    const { apiFetch } = await loadApi()
    fetchMock.mockResolvedValue(
      jsonResponse({
        criteria_total: 80,
        received_at: "2026-10-15T12:00:00Z",
        attachments: [{ virus_total: "12/70", sha256: "abc" }],
        decision: null,
      })
    )

    await expect(apiFetch("/analyses/1")).resolves.toEqual({
      criteriaTotal: 80,
      receivedAt: "2026-10-15T12:00:00Z",
      attachments: [{ virusTotal: "12/70", sha256: "abc" }],
      decision: null,
    })
  })

  it("answers 204 with nothing", async () => {
    const { apiFetch } = await loadApi()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiFetch("/notifications/read")).resolves.toBeUndefined()
  })

  it("treats 401 as an expired session", async () => {
    const { apiFetch, SessionExpiredError } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse({}, 401))

    await expect(apiFetch("/me")).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it("treats 403 as a missing permission, not as a logout", async () => {
    const { apiFetch, ForbiddenError, SessionExpiredError } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse({}, 403))

    const request = apiFetch("/monitoring")

    await expect(request).rejects.toBeInstanceOf(ForbiddenError)
    await expect(request).rejects.not.toBeInstanceOf(SessionExpiredError)
  })

  it.each([
    ["our error object", { message: "Domain ist vergeben." }],
    ["FastAPI's detail", { detail: "Domain ist vergeben." }],
  ])("reads the message from %s", async (_, body) => {
    const { apiFetch, ApiError } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse(body, 409))

    const request = apiFetch("/team/domains")

    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      status: 409,
      message: "Domain ist vergeben.",
    })
  })

  it("falls back to the status text when the body is no JSON", async () => {
    const { apiFetch, ApiError } = await loadApi()
    fetchMock.mockResolvedValue(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        statusText: "Bad Gateway",
      })
    )

    const request = apiFetch("/analyses")

    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({ message: "Bad Gateway" })
  })
})

describe("apiFetch with Keycloak", () => {
  beforeEach(() => {
    auth.enabled = true
  })

  it("sends the renewed token as bearer", async () => {
    const { apiFetch } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse({}))

    await apiFetch("/me")

    expect(auth.keycloak.updateToken).toHaveBeenCalledWith(30)
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
      Authorization: "Bearer access-token",
    })
  })

  it("gives up without calling the backend when the token cannot be renewed", async () => {
    const { apiFetch, SessionExpiredError } = await loadApi()
    auth.keycloak.updateToken.mockRejectedValue(new Error("refresh failed"))

    await expect(apiFetch("/me")).rejects.toBeInstanceOf(SessionExpiredError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("errorMessage", () => {
  it("shows our own messages as they are", async () => {
    const { errorMessage, ForbiddenError } = await loadApi()

    expect(errorMessage(new ForbiddenError("Kein Zugriff."))).toBe(
      "Kein Zugriff."
    )
  })

  it("replaces fetch's English network error and unknown values", async () => {
    const { errorMessage } = await loadApi()

    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(
      "Das Backend antwortet nicht."
    )
    expect(errorMessage("kaputt")).toBe("Das Backend antwortet nicht.")
  })
})
