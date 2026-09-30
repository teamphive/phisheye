# Features

## Wahlpflicht

Ziel sind 4 Punkte pro Mitglied, bei drei Mitgliedern also 12.

| # | Feature | Punkte | Umsetzung |
|---|---------|--------|-----------|
| 1 | KI-Integration | 2 | JEV von TypeSafe bewertet den Mailtext: Phishing ja oder nein mit Konfidenz, als eigene Karte auf der Detailseite, siehe [ai-assessment.md](ai-assessment.md) |
| 2 | Team-Feature inkl. Rollenverwaltung | 2 | Teams mit den Rollen Admin, Analyst und Audit, geteilte Analyse-Historie. Das Standard-Team ist das Instanz-Team mit Instanz-Admin und -Auditor, die alle Teams sehen |
| 3 | Benachrichtigungs-System | 2 | Glocke im Header, Meldung sobald eine Analyse fertig ist, dazu E-Mail an die meldende Person |
| 4 | Such-System | 2 | Suche über Absender, Domains, Hashes und frühere Analysen |
| 5 | Background-Jobs | 1 | Analyse läuft über arq und Redis, nicht im Request |
| 6 | Anbindung an externe APIs | 1 | VirusTotal für Hash-Reputation |
| 7 | Zwei-Faktor-Authentifizierung | 1 | TOTP zusätzlich zum Login |
| 8 | Monitoring-System | 1 | Systemweites Admin-Dashboard mit Queue, Workern, Fehlerrate und VirusTotal-Kontingent |
| | **Summe** | **12** | |

## Pflicht

- Backend und web-basiertes Frontend
- Datenbankanbindung
- Nutzerverwaltung
- Tests der Kernfunktionen
- CI/CD-Pipeline für Tests und Deployment
- Betrieb unter öffentlich erreichbarer Domain

Welche Oberflächen es dafür gibt, steht in [site-structure.md](site-structure.md).
