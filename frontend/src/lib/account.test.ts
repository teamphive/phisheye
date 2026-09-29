import { describe, expect, it, vi } from "vitest"

import { toAccountSecurity } from "@/lib/account"

vi.mock("@/lib/keycloak", () => ({
  authEnabled: false,
  accountUrl: "https://phisheye.test/auth/realms/phisheye/account",
  keycloak: {},
}))

// Shortened answers of Keycloak 26.7.3 for a user with all three credentials
const credentials = [
  {
    type: "password",
    userCredentialMetadatas: [
      {
        credential: {
          id: "5f2ff761",
          type: "password",
          createdDate: 1790705378109,
        },
      },
    ],
  },
  {
    type: "otp",
    userCredentialMetadatas: [
      {
        credential: {
          id: "21262a38",
          type: "otp",
          userLabel: "Testhandy",
          createdDate: 1790705449532,
        },
      },
    ],
  },
  {
    type: "recovery-authn-codes",
    userCredentialMetadatas: [
      {
        credential: {
          id: "f245ddcd",
          type: "recovery-authn-codes",
          userLabel: "Backup-Codes",
          createdDate: 1790705462734,
        },
        infoMessage: {
          key: "recovery-codes-number-used",
          parameters: ["3/12"],
        },
      },
    ],
  },
]

const devices = [
  {
    os: "Windows",
    device: "Other",
    mobile: false,
    current: false,
    lastAccess: 1790700000,
    sessions: [
      {
        id: "old",
        ipAddress: "10.0.0.7",
        browser: "Firefox/143.0",
        lastAccess: 1790700000,
      },
    ],
  },
  {
    os: "Mac OS X",
    device: "Mac",
    mobile: false,
    current: true,
    lastAccess: 1790705399,
    sessions: [
      {
        id: "z493",
        ipAddress: "127.0.0.1",
        browser: "Chrome/152.0.7977",
        lastAccess: 1790705399,
      },
    ],
  },
]

describe("toAccountSecurity", () => {
  it("reads password, authenticators and backup codes", () => {
    const security = toAccountSecurity(credentials, devices)

    expect(security.passwordChangedAt).toBe("2026-09-29T18:09:38.109Z")
    expect(security.authenticators).toEqual([
      {
        id: "21262a38",
        label: "Testhandy",
        createdAt: "2026-09-29T18:10:49.532Z",
      },
    ])
    expect(security.recoveryCodes).toEqual({
      id: "f245ddcd",
      used: 3,
      total: 12,
      createdAt: "2026-09-29T18:11:02.734Z",
    })
  })

  it("lists this device first and names browser and system readably", () => {
    const [current, other] = toAccountSecurity(credentials, devices).devices

    expect(current).toMatchObject({
      sessionIds: ["z493"],
      browser: "Chrome 152",
      os: "macOS",
      ipAddress: "127.0.0.1",
      current: true,
    })
    expect(other).toMatchObject({ browser: "Firefox 143", os: "Windows" })
    expect(other.lastAccess).toBe("2026-09-29T16:40:00.000Z")
  })

  it("leaves out what the user has not set up", () => {
    const security = toAccountSecurity(
      [
        credentials[0],
        { type: "otp", userCredentialMetadatas: [] },
        { type: "recovery-authn-codes", userCredentialMetadatas: [] },
      ],
      []
    )

    expect(security.authenticators).toEqual([])
    expect(security.recoveryCodes).toBeNull()
    expect(security.devices).toEqual([])
  })

  it("does not guess the use of the codes when Keycloak does not tell", () => {
    const [, , codes] = credentials
    const withoutInfo = {
      ...codes,
      userCredentialMetadatas: [
        { credential: codes.userCredentialMetadatas[0].credential },
      ],
    }

    const security = toAccountSecurity([withoutInfo], [])

    expect(security.recoveryCodes).toMatchObject({ used: null, total: null })
  })
})
