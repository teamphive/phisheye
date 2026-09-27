// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

import { downloadCsv } from "@/lib/csv"

// Written as a char code, the character itself is invisible in the editor
const bom = String.fromCharCode(0xfeff)

let blob: Blob | undefined
let click: MockInstance<HTMLAnchorElement["click"]>

beforeEach(() => {
  blob = undefined

  // jsdom has no object URLs and cannot follow a download link
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL(value: Blob) {
        blob = value
        return "blob:phisheye/test"
      }

      static revokeObjectURL() {}
    }
  )
  click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {})
})

async function download(rows: (string | number | null)[][]) {
  downloadCsv("analysen.csv", rows)

  // Blob.text() drops the byte order mark, which is part of what is tested
  const bytes = await blob!.arrayBuffer()
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)
}

describe("downloadCsv", () => {
  it("hands the file to the browser under the given name", async () => {
    await download([["a"]])

    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe("analysen.csv")
    expect(link.href).toBe("blob:phisheye/test")
    expect(blob?.type).toBe("text/csv;charset=utf-8")
  })

  it("starts with a byte order mark and separates with semicolons", async () => {
    const content = await download([
      ["Betreff", "Score"],
      ["Rechnung", 87],
    ])

    expect(content).toBe(`${bom}Betreff;Score\r\nRechnung;87`)
  })

  it("leaves empty cells empty", async () => {
    expect(await download([["a", null, "c"]])).toBe(`${bom}a;;c`)
  })

  it("quotes cells with separators, quotes and line breaks", async () => {
    const content = await download([
      ['Rechnung; "dringend"', "Zeile 1\nZeile 2"],
    ])

    expect(content).toBe(`${bom}"Rechnung; ""dringend""";"Zeile 1\nZeile 2"`)
  })

  // Subjects come from phishing mails, a leading = would run as a formula
  it.each(["=HYPERLINK(1)", "+49 123", "-1", "@SUM(A1)"])(
    "defuses %j so a spreadsheet does not run it",
    async (subject) => {
      expect(await download([[subject]])).toBe(`${bom}'${subject}`)
    }
  )

  it("does not touch negative numbers", async () => {
    expect(await download([[-5]])).toBe(`${bom}-5`)
  })
})
