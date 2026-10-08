export type MailHeader = { name: string; value: string }

/**
 * Splits raw headers into one entry per header. A line that starts with
 * whitespace continues the header before it (folding, RFC 5322).
 */
export function parseHeaders(raw: string): MailHeader[] {
  const headers: MailHeader[] = []

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue

    const last = headers.at(-1)
    if (/^[ \t]/.test(line) && last) {
      last.value = `${last.value} ${line.trim()}`
      continue
    }

    const colon = line.indexOf(":")
    headers.push(
      colon > 0
        ? {
            name: line.slice(0, colon).trim(),
            value: line.slice(colon + 1).trim(),
          }
        : { name: "", value: line.trim() }
    )
  }

  return headers
}

// What an analyst looks at first, in this order
const keyHeaderNames = [
  "from",
  "reply-to",
  "return-path",
  "to",
  "subject",
  "date",
  "authentication-results",
  "received-spf",
  "message-id",
]

/**
 * The headers that matter most for a verdict. A header that comes more than
 * once counts with its first entry, the one our own mail server added last.
 */
export function keyHeaders(headers: MailHeader[]): MailHeader[] {
  return keyHeaderNames.flatMap((name) => {
    const found = headers.find((header) => header.name.toLowerCase() === name)
    return found ? [found] : []
  })
}
