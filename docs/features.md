# Wahlpflicht-Features

Ziel: 4 Punkte pro Mitglied — bei einem 3er-Team **12 Punkte**.

| # | Feature | Punkte | Umsetzung in phisheye |
|---|---------|--------|------------------------|
| 1 | KI-Integration | 2 | LLM bewertet die Analyse-Ergebnisse und erstellt den Bericht im Klartext |
| 2 | Team-Feature inkl. Rollenverwaltung | 2 | Teams mit Rollen (Admin / Analyst), geteilte Analyse-Historie |
| 3 | Benachrichtigungs-System (Glocke + Web-Push) | 2 | Hinweis, sobald eine Analyse abgeschlossen ist |
| 4 | Such-System (Suchfunktion) | 2 | Suche über Absender, Domains, Hashes und frühere Analysen |
| 5 | Background-Jobs / asynchrone Verarbeitung | 1 | Analyse läuft über arq + Redis, nicht im Request |
| 6 | Anbindung an externe APIs | 1 | VirusTotal-API für Hash- und Datei-Reputation |
| 7 | Zwei-Faktor-Authentifizierung (2FA) | 1 | TOTP zusätzlich zum Login |
| 8 | Monitoring-System (Admin-Dashboard) | 1 | Systemauslastung, Queue-Status, Fehlerraten |
|   | **Summe** | **12** | |

## Pflicht-Features

Zusätzlich verpflichtend für jedes Team:

- Backend & web-basiertes Frontend
- Datenbankanbindung
- Nutzerverwaltung
- Tests der Kernfunktionen
- CI/CD-Pipeline (Tests und Deployment automatisiert)
- Betrieb unter öffentlich erreichbarer Domain

## Frontend Features

### Auth
- Login
- Registrierung
- 2FA-Abfrage beim Login
- 2FA-Einrichtung (QR-Code + Backup-Codes)

### Analyse
- Upload (.eml / .msg, Drag & Drop)
- Analyse-Detailseite (Verdikt, LLM-Bericht, Hop-Kette mit Screenshots, Belege)
- Analyse-Liste / Historie
- Fortschrittsanzeige während der laufenden Analyse

### Suche
- Suchleiste
- Trefferseite (Absender, Domains, Hashes)

### Team
- Mitgliederliste
- Einladung
- Rollenverwaltung

### Benachrichtigungen
- Glocke im Header
- Benachrichtigungs-Dropdown
- Web-Push-Erlaubnis abfragen

### Admin
- Monitoring-Dashboard (Queue-Status, Auslastung, Fehler)

### Profil
- Eigene Einstellungen
- 2FA verwalten
