<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo/horizontal/phisheye-horizontal-mono-7da3f5.svg">
  <img src="assets/logo/horizontal/phisheye-horizontal-mono-1a1f3a.svg" alt="phisheye" width="300">
</picture>

**Gemeldete Phishing-Mails an einer Stelle prüfen, entscheiden und nachvollziehen.**

[![Backend CI](https://github.com/teamphive/phisheye/actions/workflows/backend-ci.yml/badge.svg?branch=main)](https://github.com/teamphive/phisheye/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/teamphive/phisheye/actions/workflows/frontend-ci.yml/badge.svg?branch=main)](https://github.com/teamphive/phisheye/actions/workflows/frontend-ci.yml)

</div>

phisheye nimmt verdächtige Mails aus Outlook-Meldungen und Uploads an, bewertet sie mit Regelprüfungen und VirusTotal und legt sie dem Security-Team zur Entscheidung vor.

## Warum phisheye?

- **Ein Eingang** für alle gemeldeten Mails, aus Outlook oder per Upload
- **Routineprüfung automatisch:** Regelprüfungen und VirusTotal laufen, bevor jemand die Mail öffnet
- **Nachvollziehbar:** Wer wie entschieden hat, bleibt sichtbar und durchsuchbar

![phisheye: Analyse öffnen, Phishing bestätigen, Befunde durchsehen](docs/img/analyse.gif)

## Features

- **Outlook-Meldungen und Upload** von `.eml` und `.msg`, automatisch dem richtigen Team zugeordnet
- **Risiko-Score** aus vier Regelprüfungen, mit Verdikt sauber, verdächtig oder Phishing
- **Header, Anhänge und VirusTotal-Abgleich** der Anhang-Hashes
- **Entscheiden im Team**, mit Name und Zeitpunkt, zurücknehmbar
- **Suche** nach Betreff, Absender und Anhang-Hash
- **Teams mit Rollen** und Login mit 2FA über Keycloak

## Schnellstart

```bash
cp .env.example .env
just dev
just seed
```

Voraussetzungen, Test-Accounts und Server-Setup: [`setup.md`](setup.md).

## Techstack

React, FastAPI, PostgreSQL, Redis, MinIO, Keycloak und Docker Compose. Details in [`docs/techstack.md`](docs/techstack.md).

## Dokumentation

Konzept, API, Datenmodell und Betrieb stehen in [`docs/`](docs/).

## Team

phisheye ist ein Teamprojekt von **teamphive**: Adrijus Lazdauskas, Tom Lammers und Oliver Neumann.
