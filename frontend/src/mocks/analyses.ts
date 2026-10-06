// Placeholder data until the API exists. Everything here is invented.
// Times are ISO 8601 in UTC, exactly as the API will deliver them.

export type Verdict = "clean" | "suspicious" | "phishing"
export type AnalysisStatus = "running" | "completed" | "failed"

/** Uploaded in phisheye, or reported in Outlook and fetched from the mailbox. */
export type AnalysisSource = "upload" | "report"

export type AnalysisListItem = {
  id: string
  subject: string
  sender: string
  status: AnalysisStatus
  verdict: Verdict | null
  score: number | null
  /** Null for a report nobody has taken on yet. */
  handler: string | null
  source: AnalysisSource
  /** Address of whoever reported the mail in Outlook, null for uploads. */
  reportedBy: string | null
  receivedAt: string
}

export const verdictLabel: Record<Verdict, string> = {
  clean: "Sauber",
  suspicious: "Verdächtig",
  phishing: "Phishing",
}

export const analyses: AnalysisListItem[] = [
  // Done, but the detection gave no score, as the backend does for now
  {
    id: "a-2026-0132",
    subject: "Einladung: Quartalsgespräch Vertrieb",
    sender: "kalender@hansa-logistik.de",
    status: "completed",
    verdict: null,
    score: null,
    handler: null,
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-03T07:31:00Z",
  },
  {
    id: "a-2026-0128",
    subject: "Ihre Rechnung RE-2024-88431 ist überfällig",
    sender: "buchhaltung@dhl-versand-tracking.top",
    status: "completed",
    verdict: "phishing",
    score: 100,
    handler: "M. Sandmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-03T07:12:00Z",
  },
  {
    id: "a-2026-0127",
    subject: "Zahlungsaufforderung - dringend, vertraulich",
    sender: "geschaeftsfuehrung@hansa-Iogistik.de",
    status: "completed",
    verdict: "phishing",
    score: 97,
    handler: "M. Sandmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-03T06:41:00Z",
  },
  {
    id: "a-2026-0126",
    subject: "Microsoft 365: Ihr Passwort läuft in 24 Stunden ab",
    sender: "security@rnicrosoft-login.com",
    status: "completed",
    verdict: "phishing",
    score: 91,
    handler: null,
    source: "report",
    reportedBy: "j.meyer@hansa-logistik.de",
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
    source: "upload",
    reportedBy: null,
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
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-03T07:23:00Z",
  },
  {
    id: "a-2026-0125",
    subject: "AW: Angebot Q3 - bitte kurzfristig freigeben",
    sender: "k.wagner@hansa-logistik.de.co",
    status: "completed",
    verdict: "suspicious",
    score: 68,
    handler: "L. Brinkmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-03T06:02:00Z",
  },
  {
    id: "a-2026-0124",
    subject: "Bewerbung als Fachinformatiker - Unterlagen",
    sender: "j.brandt@gmx.de",
    status: "completed",
    verdict: "suspicious",
    score: 51,
    handler: "T. Özdemir",
    source: "upload",
    reportedBy: null,
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
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-02T13:20:00Z",
  },
  {
    id: "a-2026-0122",
    subject: "Wartungsfenster Fileserver am 03.09.",
    sender: "it-betrieb@hansa-logistik.de",
    status: "completed",
    verdict: "clean",
    score: 3,
    handler: null,
    source: "report",
    reportedBy: "p.hartmann@hansa-logistik.de",
    receivedAt: "2026-09-02T09:05:00Z",
  },
  {
    id: "a-2026-0121",
    subject: "DocuSign: Bitte Arbeitsvertrag prüfen und unterzeichnen",
    sender: "dse@docusign-envelope.net",
    status: "completed",
    verdict: "phishing",
    score: 88,
    handler: "L. Brinkmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-01T15:37:00Z",
  },
  {
    id: "a-2026-0120",
    subject: "Einladung: Quartalsmeeting Vertrieb",
    sender: "s.meyer@hansa-logistik.de",
    status: "completed",
    verdict: "clean",
    score: 0,
    handler: "M. Sandmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-01T11:02:00Z",
  },
  {
    id: "a-2026-0119",
    subject: "Ihre Mailbox ist zu 98 % voll",
    sender: "admin@mail-quota-service.com",
    status: "completed",
    verdict: "phishing",
    score: 79,
    handler: null,
    source: "report",
    reportedBy: "s.peters@hansa-logistik.com",
    receivedAt: "2026-08-31T08:44:00Z",
  },
  {
    id: "a-2026-0118",
    subject: "Geänderte Bankverbindung ab September",
    sender: "rechnung@spedition-kraemer.de",
    status: "completed",
    verdict: "suspicious",
    score: 60,
    handler: "L. Brinkmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-08-29T13:15:00Z",
  },
  {
    id: "a-2026-0117",
    subject: "Newsletter September: Neues aus der Logistik",
    sender: "news@logistik-heute.de",
    status: "completed",
    verdict: "clean",
    score: 20,
    handler: "M. Sandmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-08-28T07:30:00Z",
  },
  {
    id: "a-2026-0116",
    subject: "Sicherheitswarnung: Ungewöhnliche Anmeldung erkannt",
    sender: "no-reply@accounts-google.security-check.co",
    status: "completed",
    verdict: "phishing",
    score: 94,
    handler: "T. Özdemir",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-08-27T16:58:00Z",
  },
]

/** A second team, so switching teams visibly changes the list. */
const socAnalyses: AnalysisListItem[] = [
  {
    id: "a-2026-0129",
    subject: "Dringend: Zugangsdaten VPN aktualisieren",
    sender: "helpdesk@hansa-logistik-it.support",
    status: "completed",
    verdict: "phishing",
    score: 85,
    handler: "L. Brinkmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-03T05:48:00Z",
  },
  {
    id: "a-2026-0115",
    subject: "Lieferavis KW 36",
    sender: "avis@spedition-kraemer.de",
    status: "completed",
    verdict: "clean",
    score: 5,
    handler: "M. Sandmann",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-02T22:10:00Z",
  },
]

/** Reports from domains no team has, they land in the default team. */
const standardAnalyses: AnalysisListItem[] = [
  {
    id: "a-2026-0134",
    subject: "Offene Rechnung Nr. 2026-4471 – letzte Mahnung",
    sender: "buchhaltung@inkasso-zentrale24.top",
    status: "completed",
    verdict: "phishing",
    score: 88,
    handler: null,
    source: "report",
    reportedBy: "k.lange@bauhof-meyer.de",
    receivedAt: "2026-09-03T08:20:00Z",
  },
  {
    id: "a-2026-0133",
    subject: "Einladung: Hafenfest 2026",
    sender: "events@hafenverein-nord.de",
    status: "completed",
    verdict: "clean",
    score: 8,
    handler: null,
    source: "report",
    reportedBy: "r.weber@bauhof-meyer.de",
    receivedAt: "2026-09-02T12:35:00Z",
  },
]

/** A team the signed in user only sees through the instance role. */
const reedereiAnalyses: AnalysisListItem[] = [
  {
    id: "a-2026-0136",
    subject: "Frachtbrief MV Nordlicht – bitte prüfen",
    sender: "dispo@nordsee-reederei-cargo.top",
    status: "completed",
    verdict: "suspicious",
    score: 58,
    handler: "H. Jansen",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-03T07:05:00Z",
  },
  {
    id: "a-2026-0135",
    subject: "Liegeplatzbestätigung Container-Terminal",
    sender: "terminal@ct-weserport.de",
    status: "completed",
    verdict: "clean",
    score: 11,
    handler: "P. Claussen",
    source: "upload",
    reportedBy: null,
    receivedAt: "2026-09-02T15:50:00Z",
  },
]

const analysesByTeam: Record<string, AnalysisListItem[]> = {
  itsec: analyses,
  soc: socAnalyses,
  standard: standardAnalyses,
  reederei: reedereiAnalyses,
}

export function mockAnalyses(teamId: string): AnalysisListItem[] {
  return analysesByTeam[teamId] ?? []
}

export function mockDeleteAnalysis(id: string) {
  for (const [teamId, items] of Object.entries(analysesByTeam)) {
    analysesByTeam[teamId] = items.filter((item) => item.id !== id)
  }
}

/** Looks through every team, the detail placeholder borrows from the list. */
export function findMockAnalysis(id: string) {
  return Object.values(analysesByTeam)
    .flat()
    .find((item) => item.id === id)
}
