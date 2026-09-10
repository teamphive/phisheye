import { authEnabled, keycloak } from "@/lib/keycloak"

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

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

/**
 * Every call to the backend goes through here, so the token handling exists
 * exactly once. Throws on anything but a successful answer.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
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

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T)
}
