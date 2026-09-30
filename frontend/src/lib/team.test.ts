import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/keycloak", () => ({
  authEnabled: false,
  keycloak: { tokenParsed: undefined },
}))

const fetchMock = vi.fn<typeof fetch>()

// The base URL is read once when the module loads, so every test gets a fresh one
async function load() {
  vi.resetModules()
  return { team: await import("@/lib/team") }
}

function answer(body: unknown = {}) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    })
  )
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return {
    url,
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

describe("with a backend", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://phisheye.test/api")
  })

  it.each([
    [
      "invites",
      (t: typeof import("@/lib/team")) =>
        t.inviteMember("itsec", "neu@firma.de", "audit"),
      "POST",
      "/team/invitations",
      { email: "neu@firma.de", role: "audit" },
    ],
    [
      "changes an invitation's role",
      (t: typeof import("@/lib/team")) =>
        t.changeInvitationRole("itsec", "i-1", "admin"),
      "PATCH",
      "/team/invitations/i-1",
      { role: "admin" },
    ],
    [
      "withdraws an invitation",
      (t: typeof import("@/lib/team")) => t.revokeInvitation("itsec", "i-1"),
      "DELETE",
      "/team/invitations/i-1",
      undefined,
    ],
    [
      "changes a member's role",
      (t: typeof import("@/lib/team")) =>
        t.changeMemberRole("itsec", "m-7", "analyst"),
      "PATCH",
      "/team/members/m-7",
      { role: "analyst" },
    ],
    [
      "removes a member",
      (t: typeof import("@/lib/team")) => t.removeMember("itsec", "m-7"),
      "DELETE",
      "/team/members/m-7",
      undefined,
    ],
    [
      "leaves by removing the own membership",
      (t: typeof import("@/lib/team")) => t.leaveTeam("itsec", "m-self"),
      "DELETE",
      "/team/members/m-self",
      undefined,
    ],
    [
      "renames the active team",
      (t: typeof import("@/lib/team")) => t.renameTeam("itsec", "SOC Nord"),
      "PATCH",
      "/team",
      { name: "SOC Nord" },
    ],
    [
      "deletes the active team",
      (t: typeof import("@/lib/team")) => t.deleteTeam("itsec"),
      "DELETE",
      "/team",
      undefined,
    ],
  ])("%s", async (_, call, method, path, body) => {
    const { team } = await load()
    answer()

    await call(team)

    expect(lastRequest()).toEqual({
      url: `https://phisheye.test/api${path}`,
      method,
      body,
    })
  })

  it("resends by withdrawing the invitation and making it anew", async () => {
    const { team } = await load()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 9,
            email: "neu@firma.de",
            role: "audit",
            invited_at: "2026-09-30T10:00:00Z",
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      )

    const fresh = await team.resendInvitation("itsec", {
      id: "4",
      email: "neu@firma.de",
      role: "audit",
      invitedAt: "2026-09-20T08:00:00Z",
    })

    expect(
      fetchMock.mock.calls.map(([url, init]) => [init?.method, url])
    ).toEqual([
      ["DELETE", "https://phisheye.test/api/team/invitations/4"],
      ["POST", "https://phisheye.test/api/team/invitations"],
    ])
    expect(lastRequest().body).toEqual({ email: "neu@firma.de", role: "audit" })
    expect(fresh).toMatchObject({ invitedAt: "2026-09-30T10:00:00Z" })
  })

  it("creates a team and hands its id on as a string", async () => {
    const { team } = await load()
    answer({ id: 7, name: "SOC Nord", member_count: 1, role: "admin" })

    const created = await team.createTeam("SOC Nord")

    expect(lastRequest()).toEqual({
      url: "https://phisheye.test/api/teams",
      method: "POST",
      body: { name: "SOC Nord" },
    })
    expect(created).toEqual({
      id: "7",
      name: "SOC Nord",
      memberCount: 1,
      role: "admin",
    })
  })
})
