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

Ohne User kein Login. Einmalig anlegen:

1. http://localhost:8080 öffnen, mit `KEYCLOAK_ADMIN_USER` und `KEYCLOAK_ADMIN_PASSWORD` aus der `.env` anmelden.
2. Realm `phisheye` wählen, Users, Add user (E-Mail setzen, Passwort unter Credentials).
3. Bei Bedarf unter Role mapping die Rolle `operator` zuweisen.

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
