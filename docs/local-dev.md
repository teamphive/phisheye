# Lokale Entwicklungsumgebung

## Starten

```bash
docker compose up -d
```

## Stoppen

```bash
docker compose down
```

## Stoppen + Volumes löschen (z.B. bei kaputter DB)

```bash
docker compose down -v
```

## Logs anschauen

```bash
docker compose logs -f
```

## pgAdmin

Läuft unter `http://localhost:8888`, Login mit den Werten aus `.env` (`PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`).
