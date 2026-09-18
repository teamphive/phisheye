# phisheye backend

FastAPI-Backend für phisheye.

## Voraussetzungen

Postgres und Redis laufen (siehe `docker-compose.yml` im Root), `.env` ist befüllt (siehe `.env.example`).

## Ausführen

```bash
uv run uvicorn app.main:app --reload
```

Läuft unter `http://localhost:8000`, Docs (Swagger UI) unter `http://localhost:8000/docs`.

## Worker

Verarbeitet eingehende Mails per POP3-Polling (alle 60s):

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
