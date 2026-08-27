# phisheye 🎣👁️

Fullstack-App zur Phishing-Erkennung von Mails via VirusTotal-API (Header/Metadaten/Hash-Analyse), mit Team-Verwaltung.

## Techstack

### Fix

- **Backend:** FastAPI (Python)
- **Frontend:** React + TypeScript (Vite)
- **CI/CD:** GitHub Actions

### Noch offen

- **ORM/DB:** SQLModel + Alembic -> PostgreSQL
- **Auth:** passlib + python-jose (JWT)
- **Mail-Parsing:** `email` (stdlib) + `hashlib`
- **HTTP-Client:** httpx (async, für VirusTotal-API)
- **Tests:** pytest, pytest-asyncio, respx (VT-Mocking)

- **Queue:** arq + Redis
- **Deploy:** Docker Compose, Traefik/nginx, Prometheus + Grafana

## Status

🚧 In Entwicklung
