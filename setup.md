# Setup

## Lokal

```bash
brew install uv
brew install node
brew install just
brew install colima
brew install docker
brew install docker-compose
```

Colima (oder Docker Desktop) muss laufen. `git-cliff` braucht nur, wer Releases baut.

```bash
cp .env.example .env
# Passwörter in .env anpassen
just dev
```

`just dev` baut und startet alles in Docker: Postgres, Redis, MinIO, Keycloak, pgAdmin, Migration, Backend, Worker und Frontend. Der erste Build dauert ein paar Minuten. Danach helfen `just logs` (optional mit Dienst, zum Beispiel `just logs worker`) und `just stop`.

- Frontend: http://localhost:5173
- API-Docs: http://localhost:8000/docs
- Keycloak: http://localhost:8080

Einzelne Teile mit Hot Reload: nur die Infrastruktur mit `docker compose up -d` starten, Backend und Frontend wie in den READMEs von `backend/` und `frontend/` beschrieben. Laufen die Container von `just dev`, blockieren sie die Ports 8000 und 5173.

### Erster Login

```bash
just seed
```

Keycloak braucht nach dem Start einen Moment. Läuft `just seed` in einen Verbindungsfehler, kurz warten (`just logs keycloak`, bis "started in" erscheint) und wiederholen.

`just seed` legt fünf User an, alle mit dem Passwort `phisheye` und ohne 2FA:

| User | Team und Rolle |
| --- | --- |
| `admin@phisheye.example` | Dev-Team, Admin (und Operator) |
| `analyst@phisheye.example` | Dev-Team, Analyst |
| `audit@phisheye.example` | Dev-Team, Audit |
| `standard@phisheye.example` | Standard-Team, Admin (Instanz-Admin, sieht alle Teams) |
| `auditor@phisheye.example` | Standard-Team, Audit (Instanz-Auditor, liest alle Teams) |

Das Standard-Team bekommt die Outlook-Meldungen von Domains, die kein Team eingetragen hat.

Dazu legt es den Client `phisheye-backend-admin` in Keycloak an, falls er fehlt. Es läuft nur lokal und lässt sich beliebig oft wiederholen.

Server: [docs/infrastructure.md](docs/infrastructure.md).

## AWS / Tofu

Nur nötig für `infra/`.

```bash
brew install awslogin opentofu
```

IAM-User (nicht Root) verwenden, Access Key erstellen:

IAM -> Users -> dein User -> "Security credentials" -> "Access keys" -> "Create access key" (CLI-Use-Case) -> ID + Secret sichern.

```bash
aws configure
# Access Key ID, Secret Access Key, eu-central-1, json

# prüft ob's klappt
aws sts get-caller-identity
tofu -version
```
