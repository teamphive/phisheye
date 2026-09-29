import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  formatDate,
  formatDateTime,
  formatDay,
  formatDecimal,
  formatDelta,
  formatDuration,
  formatElapsed,
  formatFileSize,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatShortDateTime,
  formatTime,
  formatWeekday,
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

  it("shows a share as percent with one decimal", () => {
    expect(formatPercent(0.083)).toBe("8,3 %")
    expect(formatPercent(0)).toBe("0,0 %")
  })

  it("puts a sign in front of a change, a real minus included", () => {
    expect(formatDelta(8)).toBe("+8")
    expect(formatDelta(-3)).toBe("−3")
    expect(formatDelta(0)).toBe("±0")
    expect(formatDelta(1284)).toBe("+1.284")
  })
})

describe("formatDuration", () => {
  it("keeps the two largest units", () => {
    expect(formatDuration(47)).toBe("47 Min")
    expect(formatDuration(125)).toBe("2 Std 5 Min")
    expect(formatDuration(120)).toBe("2 Std")
    expect(formatDuration(60 * 27)).toBe("1 Tag 3 Std")
    expect(formatDuration(60 * 48)).toBe("2 Tage")
  })

  it("rounds to whole minutes", () => {
    expect(formatDuration(46.6)).toBe("47 Min")
  })
})

describe("calendar days from the API", () => {
  it("formats the day itself, not the UTC midnight before it", () => {
    expect(formatDay("2026-09-23")).toBe("23.09.")
    expect(formatWeekday("2026-09-23")).toBe("Mi., 23.09.")
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
