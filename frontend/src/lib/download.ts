/** Hands a file built or fetched in the browser to the download dialog. */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()

  // Revoked a tick later, some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
