// Placeholder data until the API exists. Everything here is invented.

import type { AnalysisStatus, Verdict } from "@/mocks/analyses"

export type Criterion = {
  name: string
  finding: string
  weight: number
}

export type AnalysisLink = {
  text: string
  target: string
  finding: string
  tone: Verdict
}

export type Attachment = {
  filename: string
  /** Bytes, the browser formats them. */
  size: number
  detectedType: string
  typeMismatch: boolean
  sha256: string
  virusTotal: string
  malicious: boolean
}

export type Decision = {
  verdict: "phishing" | "clean"
  by: string
  at: string
}

export type AnalysisDetail = {
  id: string
  subject: string
  sender: string
  status: AnalysisStatus
  verdict: Verdict | null
  score: number | null
  thresholds: { suspicious: number; phishing: number }
  handler: string
  receivedAt: string
  durationSeconds: number | null
  criteria: Criterion[]
  criteriaTotal: number
  links: AnalysisLink[]
  attachments: Attachment[]
  rawHeaders: string
  decision: Decision | null
  step: string | null
  startedAt: string | null
  error: {
    detail: string
    step: string
    attempt: number
    maxAttempts: number
    at: string
  } | null
}

const thresholds = { suspicious: 40, phishing: 75 }

const completed: AnalysisDetail = {
  id: "a-2026-0128",
  subject: "Ihre Rechnung RE-2024-88431 ist überfällig",
  sender: "buchhaltung@dhl-versand-tracking.top",
  status: "completed",
  verdict: "phishing",
  score: 100,
  thresholds,
  handler: "M. Sandmann",
  receivedAt: "2026-09-03T07:12:00Z",
  durationSeconds: 41,
  criteriaTotal: 120,
  criteria: [
    {
      name: "Authentifizierung fehlgeschlagen",
      finding: "spf=fail · dkim=fail · dmarc=fail (p=none)",
      weight: 40,
    },
    {
      name: "Anzeigetext weicht vom Linkziel ab",
      finding: "„Rechnung ansehen“ → t.co-redirect.click",
      weight: 30,
    },
    {
      name: "Anhang-Typ passt nicht zur Endung",
      finding: "Rechnung_RE-2024-88431.pdf.htm ist text/html",
      weight: 30,
    },
    {
      name: "From weicht von Reply-To ab",
      finding: "mail-reply-service.top statt dhl-versand-tracking.top",
      weight: 20,
    },
  ],
  links: [
    {
      text: "Rechnung ansehen",
      target:
        "https://t.co-redirect.click/r?u=…&e=m.sandmann%40hansa-logistik.de",
      finding: "Open Redirect",
      tone: "phishing",
    },
    {
      text: "Abmelden",
      target: "http://185.203.118.44/unsub",
      finding: "IP statt Domain",
      tone: "suspicious",
    },
    {
      text: "DHL Kundenservice",
      target: "https://www.dhl.de/kundenservice",
      finding: "Unauffällig",
      tone: "clean",
    },
  ],
  attachments: [
    {
      filename: "Rechnung_RE-2024-88431.pdf.htm",
      size: 12698,
      detectedType: "text/html statt PDF",
      typeMismatch: true,
      sha256:
        "3b192e256b9d34c47200e3cbb35c6db4b89e29c168eda1458fccf3c56810bc5b",
      virusTotal: "42 / 71",
      malicious: true,
    },
  ],
  rawHeaders: `From:            DHL Rechnungsservice <buchhaltung@dhl-versand-tracking.top>
Reply-To:        billing-desk@mail-reply-service.top
Return-Path:     <bounce@srv14.dhl-versand-tracking.top>
To:              m.sandmann@hansa-logistik.de
Date:            Thu, 03 Sep 2026 07:58:12 +0200
Message-ID:      <a41b7f@srv14.mailer-out.top>
X-Mailer:        PHPMailer 6.8.0
Auth-Results:    spf=fail dkim=fail dmarc=fail (p=none)`,
  decision: null,
  step: null,
  startedAt: null,
  error: null,
}

const running: AnalysisDetail = {
  ...completed,
  id: "a-2026-0130",
  subject: "Neue Sprachnachricht (0:42)",
  sender: "voicemail@pbx-cloud.click",
  status: "running",
  verdict: null,
  score: null,
  handler: "T. Özdemir",
  receivedAt: "2026-09-03T07:23:00Z",
  durationSeconds: null,
  criteria: [],
  criteriaTotal: 0,
  links: [],
  attachments: [],
  rawHeaders: "",
  step: "Anhänge werden geprüft",
  startedAt: "2026-09-03T07:23:00Z",
}

const failed: AnalysisDetail = {
  ...running,
  id: "a-2026-0131",
  subject: "Ihr Paket konnte nicht zugestellt werden",
  sender: "tracking@paket-status.top",
  status: "failed",
  handler: "T. Özdemir",
  receivedAt: "2026-09-03T06:12:00Z",
  step: null,
  startedAt: null,
  error: {
    detail:
      "Die Anfrage an VirusTotal wurde abgelehnt, weil das Tageskontingent aufgebraucht ist. Es liegt kein Verdikt vor — die Mail wurde nicht bewertet.",
    step: "Anhänge prüfen",
    attempt: 3,
    maxAttempts: 3,
    at: "2026-09-03T06:13:41Z",
  },
}

/** The analysis a mock upload leads to, so the detail page has something to show. */
export const runningAnalysisId = running.id

export type QueueItem = {
  /** Place in the queue across all teams. */
  position: number
  subject: string
  sender: string
  submittedBy: string
  queuedAt: string
}

export type Queue = {
  /** Every waiting job, including those of other teams. */
  waiting: number
  workersBusy: number
  workersTotal: number
  /** Only the jobs of the active team, other teams' mails stay hidden. */
  items: QueueItem[]
}

function secondsAgo(seconds: number) {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

export function mockQueue(): Queue {
  return {
    waiting: 3,
    workersBusy: 2,
    workersTotal: 4,
    items: [
      {
        position: 1,
        subject: "Ihre Bestellung konnte nicht zugestellt werden",
        sender: "versand@paket-status.top",
        submittedBy: "T. Özdemir",
        queuedAt: secondsAgo(14),
      },
      {
        position: 2,
        subject: "Rechnung Juli 2026",
        sender: "buchhaltung@lieferant-nord.de",
        submittedBy: "M. Sandmann",
        queuedAt: secondsAgo(31),
      },
      {
        position: 3,
        subject: "Ihr Konto wurde vorübergehend gesperrt",
        sender: "service@sparkasse-sicherheit.info",
        submittedBy: "L. Brinkmann",
        queuedAt: secondsAgo(62),
      },
    ],
  }
}

export function mockAnalysis(id: string): AnalysisDetail {
  const byId: Record<string, AnalysisDetail> = {
    [running.id]: running,
    [failed.id]: failed,
  }

  return byId[id] ?? { ...completed, id }
}
