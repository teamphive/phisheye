import { describe, expect, it } from "vitest"

import { keyHeaders, parseHeaders } from "@/lib/headers"

const raw = [
  "Return-Path: <bounce@mailer.top>",
  "ARC-Seal: i=1; a=rsa-sha256; d=strato.com;",
  "\tb=AbCdEf",
  "Authentication-Results: strato.com; spf=pass",
  "Authentication-Results: other.example; spf=fail",
  "From:            Ring Team <no-reply@mail.ring.com>",
  "Subject: Dein Abo",
  "",
].join("\r\n")

describe("parseHeaders", () => {
  it("gives one entry per header and joins folded lines", () => {
    const headers = parseHeaders(raw)

    expect(headers).toHaveLength(6)
    expect(headers[1]).toEqual({
      name: "ARC-Seal",
      value: "i=1; a=rsa-sha256; d=strato.com; b=AbCdEf",
    })
    expect(headers[4]).toEqual({
      name: "From",
      value: "Ring Team <no-reply@mail.ring.com>",
    })
  })

  it("keeps a line without a name instead of dropping it", () => {
    expect(parseHeaders("kaputte Zeile")).toEqual([
      { name: "", value: "kaputte Zeile" },
    ])
  })
})

describe("keyHeaders", () => {
  it("picks the important ones in a fixed order, the first of a kind", () => {
    const names = keyHeaders(parseHeaders(raw)).map((header) => header.name)

    expect(names).toEqual([
      "From",
      "Return-Path",
      "Subject",
      "Authentication-Results",
    ])
    expect(keyHeaders(parseHeaders(raw))[3].value).toBe("strato.com; spf=pass")
  })
})
