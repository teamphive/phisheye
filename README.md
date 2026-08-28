# phisheye 🎣👁️

Web-App zur Phishing-Analyse von E-Mails: `.eml` hochladen, Header und Metadaten werden gegen deterministische Regeln geprüft, Attachment-Hashes gegen die VirusTotal-API. Ergebnis ist ein Verdikt (sauber / verdächtig / Phishing) mit Confidence-Score. Läuft im Unternehmenskontext mit Teamverwaltung.

## Repo-Struktur

```dir
├── assets
├── backend
├── docs
├── frontend
└── infra
```

## Techstack

- Backend: FastAPI, SQLModel + Alembic, PostgreSQL
- Frontend: React + TypeScript (Vite), Tailwind, shadcn/ui
- Jobs: arq + Redis
- Extern: VirusTotal-API
- Infra: AWS (ECS/Fargate, RDS, ElastiCache, CloudFront) via OpenTofu
- CI/CD: GitHub Actions

## Schnellstart

Voraussetzungen und AWS-Setup: [`setup.md`](setup.md). Start der einzelnen Teile
jeweils im README von `backend/`, `frontend/` und `infra/main/`.

## Dokumentation

- [Projektidee](docs/project-proposal.md)
- [Konzept](docs/concept.md)
- [Datenmodell](docs/data-model.md)
- [Prüfkriterien](docs/detection-criteria.md)
- [Features](docs/features.md)
- [Infrastruktur-Entscheidungen](docs/infrastructure.md)
