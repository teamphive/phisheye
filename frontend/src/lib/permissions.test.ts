import { describe, expect, it } from "vitest"

import { permissionsOf } from "@/lib/permissions"

const member = { isOperator: false, canCreateTeams: false }

// The tables of rights from docs/site-structure.md
describe("permissionsOf", () => {
  it("lets an admin do everything in the team", () => {
    expect(permissionsOf("admin", member)).toEqual({
      analyze: true,
      deleteAnalyses: true,
      manageTeam: true,
      monitor: false,
      createTeams: false,
    })
  })

  it("lets an analyst analyze and decide, but not delete or manage", () => {
    expect(permissionsOf("analyst", member)).toEqual({
      analyze: true,
      deleteAnalyses: false,
      manageTeam: false,
      monitor: false,
      createTeams: false,
    })
  })

  it("keeps audit strictly read-only", () => {
    expect(permissionsOf("audit", member)).toEqual({
      analyze: false,
      deleteAnalyses: false,
      manageTeam: false,
      monitor: false,
      createTeams: false,
    })
  })

  it("grants the monitoring by the operator flag alone", () => {
    expect(
      permissionsOf("audit", { ...member, isOperator: true }).monitor
    ).toBe(true)
    expect(permissionsOf("admin", member).monitor).toBe(false)
  })

  it("lets only the instance admin create teams, whatever the team role", () => {
    const instanceAdmin = { isOperator: true, canCreateTeams: true }

    expect(permissionsOf("audit", instanceAdmin).createTeams).toBe(true)
    expect(permissionsOf("admin", member).createTeams).toBe(false)
  })
})
