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
(cd frontend && npm install)
just dev
```

`just dev` startet Compose (Postgres, Redis, MinIO, Keycloak, pgAdmin), Backend, Worker und Frontend. Migration einmalig: `uv run --directory backend alembic upgrade head`.

- Frontend: http://localhost:5173
- API-Docs: http://localhost:8000/docs
- Keycloak: http://localhost:8080

Alles in Docker statt lokal:

```bash
docker compose --profile app up -d --build
```

### Erster Login

```bash
uv run --directory backend alembic upgrade head
just seed
```

`just seed` legt vier User an, alle mit dem Passwort `phisheye` und ohne 2FA:

| User | Team und Rolle |
| --- | --- |
| `admin@phisheye.example` | Dev-Team, Admin (und Operator) |
| `analyst@phisheye.example` | Dev-Team, Analyst |
| `audit@phisheye.example` | Dev-Team, Audit |
| `standard@phisheye.example` | Standard-Team, Admin (und Operator) |

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
