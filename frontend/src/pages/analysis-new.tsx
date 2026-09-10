import { useRef, useState } from "react"
import { useNavigate } from "react-router"
import { FileTextIcon, UploadIcon, XIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"
import { formatFileSize } from "@/lib/format"

const acceptedTypes = [".eml", ".msg"]
const maxBytes = 25 * 1024 * 1024

// The mail that is already running in the mocks, so the detail page has
// something to show once the analysis is handed over.
const runningAnalysisId = "a-2026-0130"

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
  const [sendAttachments, setSendAttachments] = useState(true)

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
                <Button variant="ghost" size="icon-sm" onClick={clear}>
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
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Optionen</CardTitle>
        </CardHeader>
        <CardContent>
          <Item className="px-0 py-3.5">
            <ItemMedia>
              <Switch
                checked={sendAttachments}
                onCheckedChange={setSendAttachments}
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Anhänge an VirusTotal übergeben</ItemTitle>
              <ItemDescription>
                Es wird zuerst der Hash geprüft. Nur wenn der unbekannt ist,
                wird die Datei hochgeladen — die verlässt damit das Unternehmen.
              </ItemDescription>
            </ItemContent>
          </Item>
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-[11.5px] text-faint">
            Analyse startet im Hintergrund, du wirst benachrichtigt.
          </span>
          <Button
            disabled={!file}
            onClick={() => navigate(`/analysen/${runningAnalysisId}`)}
          >
            Analyse starten
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
