import { useRef, useState } from "react"
import { useNavigate } from "react-router"
import { FileTextIcon, UploadIcon, XIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { createAnalysis } from "@/lib/analyses"
import { errorMessage } from "@/lib/api"
import { formatFileSize } from "@/lib/format"

const acceptedTypes = [".eml", ".msg"]
const maxBytes = 25 * 1024 * 1024

function rejectionReason(files: FileList) {
  if (files.length !== 1) {
    return "Bitte genau eine Datei ablegen."
  }

  const file = files[0]
  const name = file.name.toLowerCase()

  if (!acceptedTypes.some((type) => name.endsWith(type))) {
    return "Nur .eml und .msg werden unterstützt."
  }

  if (file.size > maxBytes) {
    return `Die Datei ist ${formatFileSize(file.size)} groß, erlaubt sind 25 MB.`
  }

  return null
}

export function AnalysisNewPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  function take(files: FileList | null) {
    if (!files || files.length === 0) return

    const reason = rejectionReason(files)

    if (reason) {
      setError(reason)
      setFile(null)
      return
    }

    setError(null)
    setFile(files[0])
  }

  async function start() {
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const analysis = await createAnalysis(file)
      navigate(`/analysen/${analysis.id}`)
    } catch (uploadError) {
      setError(errorMessage(uploadError))
      setUploading(false)
    }
  }

  function clear() {
    setFile(null)
    setError(null)

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <PageHeader
        title="Neue Analyse"
        description="Verdächtige Mail als Datei hochladen — sie wird im Team geteilt."
      />

      <Card>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept={acceptedTypes.join(",")}
            className="hidden"
            onChange={(event) => take(event.target.files)}
          />

          {file ? (
            <Item variant="outline">
              <ItemMedia
                variant="icon"
                className="size-[30px] rounded-lg bg-accent text-primary"
              >
                <FileTextIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{file.name}</ItemTitle>
                <ItemDescription>{formatFileSize(file.size)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={clear}
                  disabled={uploading}
                >
                  <XIcon />
                  <span className="sr-only">Datei entfernen</span>
                </Button>
              </ItemActions>
            </Item>
          ) : (
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                take(event.dataTransfer.files)
              }}
              className={`flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
                dragging ? "border-primary bg-accent" : "border-border"
              }`}
            >
              <UploadIcon
                className="size-[34px] text-faint"
                strokeWidth={1.6}
              />
              <h3 className="mt-3 text-[15px] font-semibold">
                Mail hier ablegen
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                oder{" "}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-primary underline underline-offset-4"
                >
                  Datei auswählen
                </button>
              </p>
              <p className="mt-1.5 font-mono text-[11px] text-faint">
                .eml oder .msg · eine Datei · max. 25 MB
              </p>
            </div>
          )}

          {error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-4">
          <span className="text-[11.5px] text-faint">
            Anhang-Hashes werden automatisch bei VirusTotal geprüft. Die Analyse
            läuft im Hintergrund, du wirst benachrichtigt.
          </span>
          <Button disabled={!file || uploading} onClick={start}>
            {uploading ? <Spinner /> : null}
            {uploading ? "Wird hochgeladen …" : "Analyse starten"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
