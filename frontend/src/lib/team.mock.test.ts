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
async function load() {
  vi.resetModules()
  return {
    team: await import("@/lib/team"),
    mocks: await import("@/mocks/session"),
    api: await import("@/lib/api"),
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  // No backend in this file: vi.resetModules() does not reset the mocked
  // @/lib/api, so the mode must not change between tests
  vi.stubEnv("VITE_API_URL", undefined)
})

describe("without a backend", () => {
  it("adds an invitation and turns down a second one", async () => {
    const { team, api } = await load()

    const invitation = await team.inviteMember("itsec", "Neu@Firma.de", "audit")
    const roster = await team.fetchTeam("itsec")

    expect(invitation.email).toBe("neu@firma.de")
    expect(roster.invitations).toContainEqual(invitation)
    await expect(
      team.inviteMember("itsec", "neu@firma.de", "analyst")
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      team.inviteMember("itsec", "l.brinkmann@hansa-logistik.de", "analyst")
    ).rejects.toBeInstanceOf(api.ApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps at least one admin in every team", async () => {
    const { team } = await load()

    // In the SOC team the signed in user is the only admin
    await expect(
      team.changeMemberRole("soc", "m-sandmann", "analyst")
    ).rejects.toMatchObject({ status: 409 })
    await expect(team.leaveTeam("soc", "m-sandmann")).rejects.toMatchObject({
      status: 409,
    })

    // In IT-Security there is a second admin, so stepping down works
    await team.changeMemberRole("itsec", "m-sandmann", "analyst")
    const roster = await team.fetchTeam("itsec")
    expect(roster.members.find((m) => m.isSelf)?.role).toBe("analyst")
  })

  it("does not let anyone leave their last team", async () => {
    const { team, mocks } = await load()

    await team.deleteTeam("soc")

    expect(mocks.teams.map((entry) => entry.id)).toEqual(["itsec"])
    await expect(team.leaveTeam("itsec", "m-sandmann")).rejects.toMatchObject({
      status: 409,
    })
  })

  it("makes the creator admin of a new team", async () => {
    const { team, mocks } = await load()

    const created = await team.createTeam("SOC Nord")
    const roster = await team.fetchTeam(created.id)

    expect(mocks.teams).toContainEqual(created)
    expect(created.role).toBe("admin")
    expect(roster.members).toHaveLength(1)
    expect(roster.members[0]).toMatchObject({ isSelf: true, role: "admin" })
  })

  it("renames a team in the session data", async () => {
    const { team, mocks } = await load()

    await team.renameTeam("soc", "SOC Nord")

    expect(mocks.teams.find((entry) => entry.id === "soc")?.name).toBe(
      "SOC Nord"
    )
  })
})
