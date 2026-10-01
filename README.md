# phisheye 🎣👁️

[![Release](https://img.shields.io/github/v/release/teamphive/phisheye?label=release)](https://github.com/teamphive/phisheye/releases/latest)
[![Backend CI](https://github.com/teamphive/phisheye/actions/workflows/backend-ci.yml/badge.svg?branch=main)](https://github.com/teamphive/phisheye/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/teamphive/phisheye/actions/workflows/frontend-ci.yml/badge.svg?branch=main)](https://github.com/teamphive/phisheye/actions/workflows/frontend-ci.yml)

Web-App zur Phishing-Analyse von E-Mails: `.eml` hochladen, Header und Metadaten werden gegen deterministische Regeln geprüft, Attachment-Hashes gegen die VirusTotal-API. Den Text der Mail bewertet zusätzlich das KI-Modell JEV. Ergebnis ist ein Verdikt (sauber / verdächtig / Phishing) mit Confidence-Score. Läuft im Unternehmenskontext mit Teamverwaltung.

## Techstack

- Backend: FastAPI, SQLModel + Alembic, PostgreSQL
- Login: Keycloak
- Storage: MinIO (S3) für die EMLs
- Frontend: React + TypeScript (Vite), Tailwind, shadcn/ui, nginx als Proxy für `/api` und `/auth`
- Jobs: arq + Redis
- Extern: VirusTotal-API, JEV von TypeSafe (KI-Einschätzung)
- Infra: Homelab (Docker Compose, Nginx Proxy Manager), AWS nur für die Budget-Überwachung (OpenTofu)
- CI/CD: GitHub Actions

## Schnellstart

```bash
cp .env.example .env
just dev
```

Voraussetzungen und erster Login: [`setup.md`](setup.md). Die einzelnen Teile stehen in den READMEs von `backend/`, `frontend/` und `infra/main/`.

`just dev` startet den kompletten Stack in Docker. Deployment auf den Server: [Infrastruktur](docs/infrastructure.md).

## Dokumentation

- [Projektidee](docs/project-proposal.md)
- [Datenmodell](docs/data-model.md)
- [Prüfkriterien](docs/detection-criteria.md)
- [Seitenstruktur](docs/site-structure.md)
- [API](docs/api.md)
- [KI-Einschätzung mit JEV](docs/ai-assessment.md)
- [UI-Mockup](assets/mockup.html)
- [Features](docs/features.md)
- [Infrastruktur-Entscheidungen](docs/infrastructure.md)
- [Release und Changelog](docs/release.md)
- [VM-Zugriff](docs/vm-access.md)
- [ADR: EML-Ablage](docs/adr-eml-storage.md)
