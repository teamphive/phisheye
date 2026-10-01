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

  it("does not let anyone leave their last own team", async () => {
    const { team, mocks } = await load()

    await team.deleteTeam("soc")
    await team.deleteTeam("itsec")

    // The team seen through the instance role does not count
    expect(
      mocks.teams.filter((entry) => !entry.viaInstance).map((entry) => entry.id)
    ).toEqual(["standard"])
    await expect(
      team.leaveTeam("standard", "m-sandmann")
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("letztes Team"),
    })
  })

  it("has no membership to end in a team seen through the instance role", async () => {
    const { team } = await load()

    await expect(
      team.leaveTeam("reederei", "m-sandmann")
    ).rejects.toMatchObject({ status: 404 })
  })

  it("makes the creator admin of a new team", async () => {
    const { team, mocks } = await load()

    const created = await team.createTeam("SOC Nord")
    const roster = await team.fetchTeam(created.id)

    expect(mocks.teams).toContainEqual(created)
    expect(created).toMatchObject({ role: "admin", viaInstance: false })
    expect(roster.members).toHaveLength(1)
    expect(roster.members[0]).toMatchObject({ isSelf: true, role: "admin" })
  })

  it("lets nobody but the instance admin create teams", async () => {
    const { team, mocks, api } = await load()
    mocks.currentUser.canCreateTeams = false

    await expect(team.createTeam("SOC Nord")).rejects.toBeInstanceOf(
      api.ForbiddenError
    )
  })

  it("keeps the default team's name and the team itself", async () => {
    const { team } = await load()

    await expect(
      team.renameTeam("standard", "Anderes Team")
    ).rejects.toMatchObject({ status: 409 })
    await expect(team.deleteTeam("standard")).rejects.toMatchObject({
      status: 409,
    })
  })

  it("has no analysts in the default team", async () => {
    const { team } = await load()

    await expect(
      team.inviteMember("standard", "neu@firma.de", "analyst")
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      team.changeMemberRole("standard", "k-wiese", "analyst")
    ).rejects.toMatchObject({ status: 422 })

    const invitation = await team.inviteMember(
      "standard",
      "neu@firma.de",
      "audit"
    )
    expect(invitation.role).toBe("audit")
  })

  it("renames a team in the session data", async () => {
    const { team, mocks } = await load()

    await team.renameTeam("soc", "SOC Nord")

    expect(mocks.teams.find((entry) => entry.id === "soc")?.name).toBe(
      "SOC Nord"
    )
  })
})
