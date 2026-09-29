import { authorizedFetch, mockLatency } from "@/lib/api"
import { accountUrl, authEnabled } from "@/lib/keycloak"
import {
  mockAccountSecurity,
  mockSignOut,
  mockSignOutOthers,
  type AccountSecurity,
  type Device,
} from "@/mocks/session"

// Keycloak's account API, only the fields the app reads. Its times are
// milliseconds for credentials and seconds for sessions.
type CredentialMetadata = {
  credential: {
    id: string
    createdDate: number
    userLabel?: string
  }
  infoMessage?: { key: string; parameters?: string[] }
}

type CredentialContainer = {
  type: string
  userCredentialMetadatas: CredentialMetadata[]
}

type DeviceRepresentation = {
  os: string
  mobile: boolean
  current: boolean
  lastAccess: number
  sessions: {
    id: string
    ipAddress: string
    browser: string
    lastAccess: number
  }[]
}

const osNames: Record<string, string> = { "Mac OS X": "macOS" }

// "Chrome/152.0.7977" becomes "Chrome 152"
function browserName(agent: string | undefined) {
  if (!agent) return "Unbekannter Browser"

  const [name, version] = agent.split("/")
  const major = version?.split(".")[0]
  return major ? `${name} ${major}` : name
}

// Keycloak reports the use of the codes as "3/12", used first
function usage(info: CredentialMetadata["infoMessage"]) {
  const [used, total] = (info?.parameters?.[0] ?? "").split("/").map(Number)

  return Number.isInteger(used) && Number.isInteger(total) && total > 0
    ? { used, total }
    : { used: null, total: null }
}

function toDevice(device: DeviceRepresentation): Device {
  const latest = [...device.sessions].sort(
    (a, b) => b.lastAccess - a.lastAccess
  )[0]

  return {
    sessionIds: device.sessions.map((session) => session.id),
    browser: browserName(latest?.browser),
    os: osNames[device.os] ?? device.os,
    ipAddress: latest?.ipAddress ?? "",
    lastAccess: new Date(device.lastAccess * 1000).toISOString(),
    current: device.current,
    mobile: device.mobile,
  }
}

/** Browser and system in one line: Chrome 152 auf macOS */
export function deviceName(device: Device) {
  return `${device.browser} auf ${device.os}`
}

/** Keycloak's answers in the shape the settings page shows. */
export function toAccountSecurity(
  credentials: CredentialContainer[],
  devices: DeviceRepresentation[]
): AccountSecurity {
  const of = (type: string) =>
    credentials.find((container) => container.type === type)
      ?.userCredentialMetadatas ?? []
  const iso = (millis: number) => new Date(millis).toISOString()

  const password = of("password")[0]?.credential
  const codes = of("recovery-authn-codes")[0]

  return {
    passwordChangedAt: password ? iso(password.createdDate) : null,
    authenticators: of("otp").map(({ credential }) => ({
      id: credential.id,
      label: credential.userLabel || null,
      createdAt: iso(credential.createdDate),
    })),
    recoveryCodes: codes
      ? {
          id: codes.credential.id,
          ...usage(codes.infoMessage),
          createdAt: iso(codes.credential.createdDate),
        }
      : null,
    // this device first, the others by their last use
    devices: devices
      .map(toDevice)
      .sort(
        (a, b) =>
          Number(b.current) - Number(a.current) ||
          b.lastAccess.localeCompare(a.lastAccess)
      ),
  }
}

async function accountJson<T>(path: string) {
  const response = await authorizedFetch(`${accountUrl}${path}`, {
    headers: { Accept: "application/json" },
  })
  return (await response.json()) as T
}

/**
 * Password, second factor, backup codes and devices straight from Keycloak.
 * Without Keycloak the placeholder values stand in, like everywhere else.
 */
export async function fetchAccountSecurity() {
  if (!authEnabled) {
    await mockLatency()
    return mockAccountSecurity()
  }

  const [credentials, devices] = await Promise.all([
    accountJson<CredentialContainer[]>("/credentials"),
    accountJson<DeviceRepresentation[]>("/sessions/devices"),
  ])

  return toAccountSecurity(credentials, devices)
}

/** Ends every session of one browser. */
export async function signOutDevice(device: Device) {
  if (!authEnabled) {
    await mockLatency()
    return mockSignOut(device.sessionIds)
  }

  await Promise.all(
    device.sessionIds.map((id) =>
      authorizedFetch(`${accountUrl}/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    )
  )
}

/** Ends every session but the one in this browser. */
export async function signOutOtherDevices() {
  if (!authEnabled) {
    await mockLatency()
    return mockSignOutOthers()
  }

  await authorizedFetch(`${accountUrl}/sessions`, { method: "DELETE" })
}
