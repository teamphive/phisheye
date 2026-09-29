import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatElapsed,
  formatFileSize,
  formatNumber,
  formatRelativeTime,
  formatShortDateTime,
  formatTime,
  initialsOf,
  shortenHash,
} from "@/lib/format"

// The config pins the timezone to UTC, so the API's timestamps come out as is.
describe("dates from the API", () => {
  const iso = "2026-10-25T21:59:00Z"

  it("formats date and time the German way", () => {
    expect(formatDateTime(iso)).toBe("25.10.2026, 21:59")
    expect(formatDate(iso)).toBe("25.10.2026")
    expect(formatShortDateTime(iso)).toBe("25.10., 21:59")
    expect(formatTime(iso)).toBe("21:59")
  })
})

describe("times relative to now", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("picks the largest fitting unit", () => {
    expect(formatRelativeTime("2026-10-15T11:59:30Z")).toBe("vor 30 Sekunden")
    expect(formatRelativeTime("2026-10-15T11:55:00Z")).toBe("vor 5 Minuten")
    expect(formatRelativeTime("2026-10-15T10:00:00Z")).toBe("vor 2 Stunden")
    expect(formatRelativeTime("2026-10-14T12:00:00Z")).toBe("gestern")
  })

  it("counts minutes and seconds since a job was queued", () => {
    expect(formatElapsed("2026-10-15T11:57:55Z")).toBe("2:05")
    expect(formatElapsed("2026-10-15T12:00:00Z")).toBe("0:00")
  })

  it("never counts backwards for a timestamp ahead of the clock", () => {
    expect(formatElapsed("2026-10-15T12:00:30Z")).toBe("0:00")
  })
})

describe("numbers", () => {
  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(2048)).toBe("2 KB")
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB")
  })

  it("separates thousands and decimals the German way", () => {
    expect(formatNumber(1284)).toBe("1.284")
    expect(formatDecimal(1.24)).toBe("1,2")
  })
})

describe("initialsOf", () => {
  it("takes the first letters of up to two words", () => {
    expect(initialsOf("Adrijus Lazdauskas")).toBe("AL")
    expect(initialsOf("anna-lena schmidt")).toBe("AL")
    expect(initialsOf("SOC Bereitschaft Nord")).toBe("SB")
    expect(initialsOf("tom")).toBe("T")
  })

  it("returns nothing for an empty name", () => {
    expect(initialsOf("")).toBe("")
  })
})

describe("shortenHash", () => {
  it("keeps start and end of a long hash", () => {
    const sha256 = "a".repeat(12) + "b".repeat(48) + "cdef"

    expect(shortenHash(sha256)).toBe("aaaaaaaaaaaa…cdef")
  })

  it("leaves short values alone", () => {
    expect(shortenHash("abc123")).toBe("abc123")
  })
})
