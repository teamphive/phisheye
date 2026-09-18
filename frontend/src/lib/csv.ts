type Cell = string | number | null

// Excel with a German locale splits on semicolons, and only reads umlauts
// correctly when the file starts with a byte order mark.
const separator = ";"
const byteOrderMark = "﻿"

// Subjects and senders come straight from phishing mails. A cell starting with
// one of these characters runs as a formula once the file is opened in a
// spreadsheet, so it gets an apostrophe in front and stays plain text.
const formulaStart = /^[=+\-@\t\r]/

function escape(value: Cell) {
  if (value === null) return ""

  let text = String(value)

  if (typeof value === "string" && formulaStart.test(text)) {
    text = `'${text}`
  }

  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Builds the file in the browser and hands it to the download dialog. */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const content = rows
    .map((row) => row.map(escape).join(separator))
    .join("\r\n")

  const blob = new Blob([byteOrderMark + content], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()

  // Revoked a tick later, some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
