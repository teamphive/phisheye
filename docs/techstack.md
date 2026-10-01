# Techstack

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
