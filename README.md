# phisheye 🎣👁️

Web-App zur Phishing-Analyse von E-Mails: `.eml` hochladen, Header und Metadaten werden gegen deterministische Regeln geprüft, Attachment-Hashes gegen die VirusTotal-API. Ergebnis ist ein Verdikt (sauber / verdächtig / Phishing) mit Confidence-Score. Läuft im Unternehmenskontext mit Teamverwaltung.

## Repo-Struktur

```dir
├── assets
├── backend
├── docker      (Keycloak-Realm, pgAdmin)
├── docs
├── frontend
├── infra       (OpenTofu, AWS)
├── docker-compose.yml
└── justfile
```

## Techstack

- Backend: FastAPI, SQLModel + Alembic, PostgreSQL
- Login: Keycloak
- Storage: MinIO (S3) für die EMLs
- Frontend: React + TypeScript (Vite), Tailwind, shadcn/ui, nginx als Proxy für `/api` und `/auth`
- Jobs: arq + Redis
- Extern: VirusTotal-API, AWS Bedrock (LLM)
- Infra: Homelab (Docker Compose, Nginx Proxy Manager), AWS nur für Bedrock + Budget (OpenTofu)
- CI/CD: GitHub Actions

## Schnellstart

```bash
cp .env.example .env
just dev
```

Voraussetzungen und erster Login: [`setup.md`](setup.md). Die einzelnen Teile stehen in den READMEs von `backend/`, `frontend/` und `infra/main/`.

Kompletter Stack in Docker: `docker compose --profile app up -d --build`. Deployment auf den Server: [Infrastruktur](docs/infrastructure.md).

## Dokumentation

- [Projektidee](docs/project-proposal.md)
- [Datenmodell](docs/data-model.md)
- [Prüfkriterien](docs/detection-criteria.md)
- [Seitenstruktur](docs/site-structure.md)
- [API](docs/api.md)
- [UI-Mockup](assets/mockup.html)
- [Features](docs/features.md)
- [Infrastruktur-Entscheidungen](docs/infrastructure.md)
- [Release und Changelog](docs/release.md)
- [VM-Zugriff](docs/vm-access.md)
- [ADR: EML-Ablage](docs/adr-eml-storage.md)
