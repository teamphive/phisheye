import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/keycloak", () => ({
  authEnabled: false,
  keycloak: { tokenParsed: undefined },
}))

const fetchMock = vi.fn<typeof fetch>()

// apiEnabled is read once when the module loads, so every test gets a fresh one
async function loadSession() {
  vi.resetModules()
  return import("@/lib/session")
}

function answerMe(body: unknown) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    })
  )
}

const me = {
  name: "Adrijus Lazdauskas",
  email: "adrijus@firma.de",
  initials: "AL",
  is_operator: true,
  instance_role: null,
  can_create_teams: false,
  teams: [
    {
      id: 1,
      name: "IT-Security",
      member_count: 4,
      role: "admin",
      via_instance: false,
    },
    {
      id: 2,
      name: "SOC Bereitschaft",
      member_count: 3,
      role: "audit",
      via_instance: false,
    },
  ],
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("VITE_API_URL", "https://phisheye.test/api")
})

describe("fetchSession", () => {
  it("reads user and teams from GET /me", async () => {
    const { fetchSession } = await loadSession()
    answerMe({ ...me, active_team_id: 2 })

    const session = await fetchSession()

    expect(fetchMock.mock.calls[0][0]).toBe("https://phisheye.test/api/me")
    expect(session.user).toEqual({
      name: "Adrijus Lazdauskas",
      email: "adrijus@firma.de",
      initials: "AL",
      isOperator: true,
      instanceRole: null,
      canCreateTeams: false,
    })
    expect(session.teams).toEqual([
      {
        id: "1",
        name: "IT-Security",
        memberCount: 4,
        role: "admin",
        viaInstance: false,
      },
      {
        id: "2",
        name: "SOC Bereitschaft",
        memberCount: 3,
        role: "audit",
        viaInstance: false,
      },
    ])
    expect(session.activeTeamId).toBe("2")
  })

  it("reads the instance role and the teams it opens", async () => {
    const { fetchSession } = await loadSession()
    answerMe({
      ...me,
      instance_role: "admin",
      can_create_teams: true,
      teams: [
        {
          id: 1,
          name: "Standard-Team",
          member_count: 2,
          role: "admin",
          via_instance: false,
        },
        {
          id: 5,
          name: "Kunde A",
          member_count: 7,
          role: "admin",
          via_instance: true,
        },
      ],
      // the instance admin works in a team they are no member of
      active_team_id: 5,
    })

    const session = await fetchSession()

    expect(session.user).toMatchObject({
      instanceRole: "admin",
      canCreateTeams: true,
    })
    expect(session.teams.map((team) => [team.id, team.viaInstance])).toEqual([
      ["1", false],
      ["5", true],
    ])
    expect(session.activeTeamId).toBe("5")
  })

  it("treats an answer without instance roles as a plain member", async () => {
    const { fetchSession } = await loadSession()
    answerMe({
      name: me.name,
      email: me.email,
      initials: me.initials,
      is_operator: false,
      teams: [{ id: 1, name: "IT-Security", member_count: 4, role: "admin" }],
    })

    const session = await fetchSession()

    expect(session.user).toMatchObject({
      instanceRole: null,
      canCreateTeams: false,
    })
    expect(session.teams[0].viaInstance).toBe(false)
  })

  it("takes the first team when the server names no active one", async () => {
    const { fetchSession } = await loadSession()
    answerMe(me)

    expect((await fetchSession()).activeTeamId).toBe("1")
  })

  it("takes the first team when the active one is no longer in the list", async () => {
    const { fetchSession } = await loadSession()
    answerMe({ ...me, active_team_id: 99 })

    expect((await fetchSession()).activeTeamId).toBe("1")
  })

  it("has no active team for someone without any team", async () => {
    const { fetchSession } = await loadSession()
    answerMe({ ...me, teams: [], active_team_id: null })

    const session = await fetchSession()

    expect(session.teams).toEqual([])
    expect(session.activeTeamId).toBeNull()
  })

  it("falls back to the placeholder data without a backend", async () => {
    vi.stubEnv("VITE_API_URL", undefined)
    const { fetchSession } = await loadSession()
    const { teams } = await import("@/mocks/session")

    const session = await fetchSession()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(session.teams).toEqual(teams)
    expect(session.activeTeamId).toBe(teams[0].id)
  })

  it("keeps the team the placeholder server was told about", async () => {
    vi.stubEnv("VITE_API_URL", undefined)
    const { fetchSession, selectTeam } = await loadSession()
    const { teams } = await import("@/mocks/session")

    await selectTeam(teams[1].id)

    expect((await fetchSession()).activeTeamId).toBe(teams[1].id)
  })
})

describe("selectTeam", () => {
  it("tells the server which team is active", async () => {
    const { selectTeam } = await loadSession()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await selectTeam("2")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://phisheye.test/api/me/team")
    expect(init?.method).toBe("POST")
    expect(init?.body).toBe(JSON.stringify({ team_id: "2" }))
  })
})
