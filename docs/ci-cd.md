# CI/CD

Alle Abläufe laufen über GitHub Actions, die Dateien liegen in `.github/workflows/`.

| Workflow | Startet bei | Macht |
| --- | --- | --- |
| [`frontend-ci.yml`](../.github/workflows/frontend-ci.yml) | Pull Request oder Push auf `main` mit Änderungen in `frontend/` | `npm ci`, Lint, Typecheck, Tests, Build |
| [`backend-ci.yml`](../.github/workflows/backend-ci.yml) | Pull Request oder Push auf `main` mit Änderungen in `backend/` | `uv sync`, Ruff (Lint und Format), Tests |
| [`deploy.yml`](../.github/workflows/deploy.yml) | Push auf `main`, außer nur Doku hat sich geändert. Auch von Hand | Baut die App auf der VM neu und wartet auf `/api/health/ready`, siehe [Deployment](infrastructure.md#deployment) |
| [`release.yml`](../.github/workflows/release.yml) | Versions-Tag wie `0.7.0` | Images nach GHCR, GitHub-Release, `CHANGELOG.md`, siehe [Release](release.md) |

- Ein neuer Push auf denselben Branch bricht den laufenden CI-Lauf ab.
- Deploys laufen nacheinander, ein laufender wird nie abgebrochen.
- Der Deploy wartet nicht auf die CI. Beide starten beim Merge gleichzeitig.
- Den Stand von `main` zeigen die Badges im [README](../README.md).

## Tests

| Teil | Wo | Deckt ab |
| --- | --- | --- |
| Frontend | `frontend/src/lib/*.test.ts` (Vitest) | API-Client und Sitzung, Konto-Sicherheit aus Keycloak, Rechte und Instanz-Rollen, Teams, Analysen, Übersicht, Mail-Header, Domains, Formatierung, CSV-Export |
| Backend | `backend/tests/` (pytest) | Upload und Analyse-Job, Erkennung, KI-Einschätzung, Zuweisung und Entscheidung, Suche, Teams, Einladungen, Instanz-Rollen, Mails, Postfach-Abruf, Monitoring, Health |

Lokal laufen dieselben Befehle wie in der CI:

```bash
cd frontend
npm run lint
npm run typecheck
npm test
```

Backend: siehe [`backend/README.md`](../backend/README.md#tests).
