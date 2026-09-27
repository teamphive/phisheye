import { describe, expect, it } from "vitest"

import { permissionsOf } from "@/lib/permissions"

// The table of rights from docs/site-structure.md
describe("permissionsOf", () => {
  it("lets an admin do everything in the team", () => {
    expect(permissionsOf("admin", false)).toEqual({
      analyze: true,
      deleteAnalyses: true,
      manageTeam: true,
      monitor: false,
    })
  })

  it("lets an analyst analyze and decide, but not delete or manage", () => {
    expect(permissionsOf("analyst", false)).toEqual({
      analyze: true,
      deleteAnalyses: false,
      manageTeam: false,
      monitor: false,
    })
  })

  it("keeps audit strictly read-only", () => {
    expect(permissionsOf("audit", false)).toEqual({
      analyze: false,
      deleteAnalyses: false,
      manageTeam: false,
      monitor: false,
    })
  })

  it("grants the monitoring by the operator flag alone", () => {
    expect(permissionsOf("audit", true).monitor).toBe(true)
    expect(permissionsOf("admin", false).monitor).toBe(false)
  })
})
