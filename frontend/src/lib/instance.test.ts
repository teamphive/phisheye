import { describe, expect, it } from "vitest"

import { isDefaultTeam, rolesFor, teamRoleLabel } from "@/lib/instance"

describe("isDefaultTeam", () => {
  it("knows the instance team by its fixed name", () => {
    expect(isDefaultTeam({ name: "Standard-Team" })).toBe(true)
    expect(isDefaultTeam({ name: "IT-Security" })).toBe(false)
  })
})

describe("rolesFor", () => {
  it("offers no analysts in the default team and preselects audit", () => {
    expect(rolesFor({ name: "Standard-Team" })).toEqual(["audit", "admin"])
  })

  it("offers every role in any other team, analyst first", () => {
    expect(rolesFor({ name: "IT-Security" })).toEqual([
      "analyst",
      "admin",
      "audit",
    ])
  })
})

describe("teamRoleLabel", () => {
  it("names the own role in a team the user belongs to", () => {
    expect(teamRoleLabel({ role: "audit", viaInstance: false })).toBe("Audit")
  })

  it("names the instance role in a team seen through it", () => {
    expect(teamRoleLabel({ role: "admin", viaInstance: true })).toBe(
      "Instanz-Admin"
    )
    expect(teamRoleLabel({ role: "audit", viaInstance: true })).toBe(
      "Instanz-Auditor"
    )
  })
})
