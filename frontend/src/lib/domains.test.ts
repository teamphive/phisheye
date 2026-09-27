import { describe, expect, it } from "vitest"

import { coveredBy, normalizeDomain } from "@/lib/domains"

describe("normalizeDomain", () => {
  it.each([
    ["Firma.DE", "firma.de"],
    ["  firma.de  ", "firma.de"],
    ["@firma.de", "firma.de"],
    ["www.firma.de", "firma.de"],
    ["firma.de.", "firma.de"],
    ["mail.firma.de", "mail.firma.de"],
    ["müller.de", "xn--mller-kva.de"],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected)
  })

  it.each([
    "",
    "firma",
    "name@firma.de",
    "firma.de/pfad",
    "https://firma.de",
    "firma de",
    "192.168.0.1",
    "-firma.de",
    "firma.d3",
  ])("rejects %j", (input) => {
    expect(normalizeDomain(input)).toBeNull()
  })
})

describe("coveredBy", () => {
  it("covers the domain itself and its subdomains", () => {
    expect(coveredBy("firma.de", "firma.de")).toBe(true)
    expect(coveredBy("mail.firma.de", "firma.de")).toBe(true)
    expect(coveredBy("a.b.firma.de", "firma.de")).toBe(true)
  })

  it("does not cover a domain that only ends with the same letters", () => {
    expect(coveredBy("evilfirma.de", "firma.de")).toBe(false)
    expect(coveredBy("firma.de", "mail.firma.de")).toBe(false)
  })
})
