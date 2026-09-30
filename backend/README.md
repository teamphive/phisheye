# phisheye backend

FastAPI-Backend für phisheye.

## Voraussetzungen

Postgres, Redis, MinIO und Keycloak laufen (`docker compose up -d` im Root). `.env` aus `.env.example` befüllen. Der Bucket aus `S3_BUCKET` wird beim ersten Upload vom Backend angelegt.

## Ausführen

```bash
uv run uvicorn app.main:app --reload
```

Läuft unter `http://localhost:8000`, Docs (Swagger UI) unter `http://localhost:8000/docs`.

## Worker

Holt gemeldete Mails per POP3 ab (alle 30s) und verschickt die Benachrichtigungen per SMTP (`SMTP_*` in der `.env`). Nur wer per Mail meldet, bekommt eine Mail. Manuelle Uploads lösen keine aus. Bei SMTP-Fehlern gibt es bis zu 5 Versuche:

```bash
uv run arq app.worker.settings.WorkerSettings
```

## Migrationen

```bash
uv run alembic upgrade head
```

Neue Migration nach Model-Änderung:

```bash
uv run alembic revision --autogenerate -m "<beschreibung>"
```

## Tests

```bash
uv run pytest
```

## Lint

```bash
uv run ruff check .
```
