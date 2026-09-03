// Placeholder data until the API exists. Everything here is invented.
// Times are ISO 8601 in UTC, exactly as the API will deliver them.

export type Verdict = "clean" | "suspicious" | "phishing"
export type AnalysisStatus = "running" | "completed" | "failed"

export type AnalysisListItem = {
  id: string
  subject: string
  sender: string
  status: AnalysisStatus
  verdict: Verdict | null
  score: number | null
  handler: string
  receivedAt: string
}

export const analyses: AnalysisListItem[] = [
  {
    id: "a-2026-0128",
    subject: "Ihre Rechnung RE-2024-88431 ist überfällig",
    sender: "buchhaltung@dhl-versand-tracking.top",
    status: "completed",
    verdict: "phishing",
    score: 100,
    handler: "M. Sandmann",
    receivedAt: "2026-09-03T07:12:00Z",
  },
  {
    id: "a-2026-0127",
    subject: "Zahlungsaufforderung – dringend, vertraulich",
    sender: "geschaeftsfuehrung@hansa-Iogistik.de",
    status: "completed",
    verdict: "phishing",
    score: 97,
    handler: "M. Sandmann",
    receivedAt: "2026-09-03T06:41:00Z",
  },
  {
    id: "a-2026-0126",
    subject: "Microsoft 365: Ihr Passwort läuft in 24 Stunden ab",
    sender: "security@rnicrosoft-login.com",
    status: "completed",
    verdict: "phishing",
    score: 91,
    handler: "L. Brinkmann",
    receivedAt: "2026-09-03T06:15:00Z",
  },
  {
    id: "a-2026-0131",
    subject: "Ihr Paket konnte nicht zugestellt werden",
    sender: "tracking@paket-status.top",
    status: "failed",
    verdict: null,
    score: null,
    handler: "T. Özdemir",
    receivedAt: "2026-09-03T06:12:00Z",
  },
  {
    id: "a-2026-0130",
    subject: "Neue Sprachnachricht (0:42)",
    sender: "voicemail@pbx-cloud.click",
    status: "running",
    verdict: null,
    score: null,
    handler: "T. Özdemir",
    receivedAt: "2026-09-03T07:23:00Z",
  },
  {
    id: "a-2026-0125",
    subject: "AW: Angebot Q3 – bitte kurzfristig freigeben",
    sender: "k.wagner@hansa-logistik.de.co",
    status: "completed",
    verdict: "suspicious",
    score: 68,
    handler: "L. Brinkmann",
    receivedAt: "2026-09-03T06:02:00Z",
  },
  {
    id: "a-2026-0124",
    subject: "Bewerbung als Fachinformatiker – Unterlagen",
    sender: "j.brandt@gmx.de",
    status: "completed",
    verdict: "suspicious",
    score: 51,
    handler: "T. Özdemir",
    receivedAt: "2026-09-02T14:48:00Z",
  },
  {
    id: "a-2026-0123",
    subject: "Ihre Bestellung wurde versandt",
    sender: "versand@otto.de",
    status: "completed",
    verdict: "clean",
    score: 8,
    handler: "M. Sandmann",
    receivedAt: "2026-09-02T13:20:00Z",
  },
  {
    id: "a-2026-0122",
    subject: "Wartungsfenster Fileserver am 03.09.",
    sender: "it-betrieb@hansa-logistik.de",
    status: "completed",
    verdict: "clean",
    score: 3,
    handler: "T. Özdemir",
    receivedAt: "2026-09-02T09:05:00Z",
  },
]

/** Stands in for the request that will later fetch the list. */
export function fetchAnalyses(delay = 700): Promise<AnalysisListItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(analyses), delay)
  })
}
