import { authEnabled, keycloak } from "@/lib/keycloak"

const configuredUrl = import.meta.env.VITE_API_URL
const baseUrl = configuredUrl ?? "http://localhost:8000"

/**
 * Without a configured backend the pages keep working on the placeholder data
 * in src/mocks, the same way the app starts without Keycloak.
 */
export const apiEnabled = Boolean(configuredUrl)

/** Stands in for the round trip while no backend is configured. */
export function mockLatency(ms = 400) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Signed in, but the role is not enough. Show it, do not sign the user out. */
export class ForbiddenError extends Error {}

/** The token could not be renewed or was rejected. Only a new login helps. */
export class SessionExpiredError extends Error {}

/** Everything else the backend answered with. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function authorization(): Promise<Record<string, string>> {
  if (!authEnabled) return {}

  try {
    // Renews only if the token runs out within the next 30 seconds.
    await keycloak.updateToken(30)
  } catch {
    // One attempt is all it gets. Trying again in a loop would keep Keycloak
    // busy and still fail, because the refresh token is gone for good.
    throw new SessionExpiredError("Deine Sitzung ist abgelaufen.")
  }

  return { Authorization: `Bearer ${keycloak.token}` }
}

async function messageOf(response: Response) {
  try {
    const body = await response.json()
    return body.message ?? body.detail ?? response.statusText
  } catch {
    return response.statusText
  }
}

// The backend stores UTC but sends it without an offset, and new Date() reads
// such a timestamp as local time. Its microseconds are more than every
// browser parses, milliseconds are enough.
const naiveTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

/**
 * The API speaks snake_case like the rest of the Python code, and its
 * timestamps get the Z they are missing.
 */
function fromApi(value: unknown): unknown {
  if (typeof value === "string" && naiveTimestamp.test(value)) {
    return `${value.replace(/(\.\d{3})\d+$/, "$1")}Z`
  }

  if (Array.isArray(value)) return value.map(fromApi)

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key.replace(/_([a-z0-9])/g, (_, letter: string) =>
          letter.toUpperCase()
        ),
        fromApi(entry),
      ])
    )
  }

  return value
}

/** A message that can be shown as it is, whatever went wrong. */
export function errorMessage(error: unknown) {
  // fetch itself fails with a TypeError when nothing answers, its message is
  // English and says nothing useful
  if (error instanceof Error && !(error instanceof TypeError)) {
    return error.message
  }

  return "Das Backend antwortet nicht."
}

/**
 * Every call with the user's token goes through here, to the backend and to
 * Keycloak's account API, so the token handling exists exactly once. Throws
 * on anything but a successful answer.
 */
export async function authorizedFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...(await authorization()), ...init.headers },
  })

  if (response.status === 401) {
    throw new SessionExpiredError("Die Anmeldung wurde abgelehnt.")
  }

  if (response.status === 403) {
    throw new ForbiddenError("Für diese Aktion fehlt dir die Berechtigung.")
  }

  if (!response.ok) {
    throw new ApiError(response.status, await messageOf(response))
  }

  return response
}

/**
 * A JSON answer. Field names arrive in camelCase, request bodies stay in the
 * API's snake_case.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await authorizedFetch(`${baseUrl}${path}`, init)

  return response.status === 204
    ? (undefined as T)
    : (fromApi(await response.json()) as T)
}

/** A file, handed over as the backend sent it. */
export async function apiBlob(path: string) {
  const response = await authorizedFetch(`${baseUrl}${path}`)
  return response.blob()
}
