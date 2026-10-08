// Placeholder data until the notifications endpoint exists. Everything here is invented.
// Times are ISO 8601 in UTC, exactly as the API will deliver them.

export type NotificationKind = "analysis" | "team" | "system"
export type NotificationTone = "phishing" | "suspicious" | "clean" | "info"

export type Notification = {
  id: string
  kind: NotificationKind
  tone: NotificationTone
  title: string
  detail: string
  target: string
  createdAt: string
  read: boolean
}

const notifications: Notification[] = [
  {
    id: "n-08",
    kind: "analysis",
    tone: "phishing",
    title: "Analyse abgeschlossen: Phishing (100 %)",
    detail: "„Ihre Rechnung RE-2024-88431 ist überfällig“",
    target: "/analysen/a-2026-0128",
    createdAt: "2026-09-10T07:48:00Z",
    read: false,
  },
  {
    id: "n-07",
    kind: "analysis",
    tone: "suspicious",
    title: "Analyse abgeschlossen: Verdächtig (68 %)",
    detail: "„AW: Angebot Q3 - bitte kurzfristig freigeben“",
    target: "/analysen/a-2026-0125",
    createdAt: "2026-09-10T07:00:00Z",
    read: false,
  },
  {
    id: "n-06",
    kind: "system",
    tone: "phishing",
    title: "Analyse fehlgeschlagen",
    detail:
      "VirusTotal-Kontingent überschritten (HTTP 429), der Job kann neu gestartet werden",
    target: "/monitoring",
    createdAt: "2026-09-10T05:41:00Z",
    read: false,
  },
  {
    id: "n-05",
    kind: "team",
    tone: "info",
    title: "T. Özdemir ist dem Team IT-Security beigetreten",
    detail: "Rolle: Analyst · eingeladen von L. Brinkmann",
    target: "/team",
    createdAt: "2026-09-09T14:04:00Z",
    read: true,
  },
  {
    id: "n-04",
    kind: "team",
    tone: "info",
    title: "L. Brinkmann hat dich zum Team SOC Bereitschaft hinzugefügt",
    detail: "Deine Rolle dort: Admin",
    target: "/team",
    createdAt: "2026-09-09T09:20:00Z",
    read: true,
  },
  {
    id: "n-03",
    kind: "analysis",
    tone: "clean",
    title: "Analyse abgeschlossen: Sauber (3 %)",
    detail: "„Wartungsfenster Fileserver am 03.09.“",
    target: "/analysen/a-2026-0122",
    createdAt: "2026-09-09T09:05:00Z",
    read: true,
  },
  {
    id: "n-02",
    kind: "analysis",
    tone: "phishing",
    title: "Analyse abgeschlossen: Phishing (97 %)",
    detail: "„Zahlungsaufforderung - dringend, vertraulich“",
    target: "/analysen/a-2026-0127",
    createdAt: "2026-08-26T13:30:00Z",
    read: true,
  },
  {
    id: "n-01",
    kind: "system",
    tone: "info",
    title: "Zwei-Faktor-Authentifizierung aktiviert",
    detail: "Eingerichtet mit einer Authenticator-App",
    target: "/einstellungen",
    createdAt: "2026-08-24T10:12:00Z",
    read: true,
  },
]

/** Copies, so the page only sees a change once it asks again. */
export function mockNotifications(): Notification[] {
  return notifications.map((entry) => ({ ...entry }))
}

/** Remembers the read state like the server would, until the page reloads. */
export function mockMarkRead(ids?: string[]) {
  for (const entry of notifications) {
    if (!ids || ids.includes(entry.id)) entry.read = true
  }
}
