# phisheye 🎣👁️

[![Backend CI](https://github.com/teamphive/phisheye/actions/workflows/backend-ci.yml/badge.svg?branch=main)](https://github.com/teamphive/phisheye/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/teamphive/phisheye/actions/workflows/frontend-ci.yml/badge.svg?branch=main)](https://github.com/teamphive/phisheye/actions/workflows/frontend-ci.yml)

Web-App zur Phishing-Analyse von E-Mails: `.eml` hochladen, Header und Metadaten werden gegen deterministische Regeln geprüft, Attachment-Hashes gegen die VirusTotal-API. Den Text der Mail bewertet zusätzlich das KI-Modell JEV. Ergebnis ist ein Verdikt (sauber / verdächtig / Phishing) mit Confidence-Score. Läuft im Unternehmenskontext mit Teamverwaltung.

## Techstack

```text
Browser
   │
nginx (Frontend)
   ├── /auth ──▶ Keycloak
   └── /api ───▶ Backend ──┬──▶ PostgreSQL
                           ├──▶ MinIO (EML)
                           └──▶ Redis
                                  │
                               Worker ──┬──▶ VirusTotal
                                        └──▶ JEV (KI)
```

- Frontend: React + TypeScript (Vite), Tailwind, shadcn/ui, nginx als Proxy für `/api` und `/auth`
- Login: Keycloak mit eigenem Login-Theme (Keycloakify)
- Backend: FastAPI, SQLModel + Alembic
- Jobs: arq + Redis, die Analyse läuft im Worker
- Daten: PostgreSQL für Ergebnisse und Teams, MinIO (S3) für die EMLs
- Extern: VirusTotal-API für Attachment-Hashes, JEV von TypeSafe für die KI-Einschätzung
- Betrieb: Homelab mit Docker Compose und Nginx Proxy Manager, AWS nur für die Budget-Überwachung (OpenTofu)
- CI/CD: GitHub Actions

## Schnellstart

```bash
cp .env.example .env
just dev
```

Voraussetzungen und erster Login: [`setup.md`](setup.md). Die einzelnen Teile stehen in den READMEs von `backend/`, `frontend/` und `infra/main/`.

`just dev` startet den kompletten Stack in Docker. Deployment auf den Server: [Infrastruktur](docs/infrastructure.md).

## Dokumentation

### Konzept

- [Projektidee](docs/project-proposal.md)
- [Features](docs/features.md)
- [Prüfkriterien](docs/detection-criteria.md)
- [KI-Einschätzung mit JEV](docs/ai-assessment.md)

### Technik

- [Datenmodell](docs/data-model.md)
- [API](docs/api.md)
- [Seitenstruktur](docs/site-structure.md)
- [UI-Mockup](assets/mockup.html)
- [ADR: EML-Ablage](docs/adr-eml-storage.md)

### Betrieb

- [Infrastruktur-Entscheidungen](docs/infrastructure.md)
- [Release und Changelog](docs/release.md)
- [VM-Zugriff](docs/vm-access.md)
