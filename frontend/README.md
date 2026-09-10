# phisheye frontend

React + TypeScript + Vite Frontend für phisheye.

## Voraussetzungen

Node muss installiert sein (siehe `docs/setup.md`).

## Installieren

```bash
npm install
```

## Konfigurieren

```bash
cp .env.example .env
```

Darin stehen die Adresse von Keycloak und die des Backends. Ohne diese Datei startet die App ohne Anmeldung, damit sich die Oberfläche auch ohne laufendes Keycloak ansehen lässt. Mit der Datei verlangt jeder Seitenaufruf ein Token, Keycloak muss also erreichbar sein (`docker compose up -d keycloak` im Wurzelverzeichnis).

## Ausführen (Dev-Server)

```bash
npm run dev
```

Läuft dann unter `http://localhost:5173`.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Stand

Grundgerüst via Vite aufgesetzt, shadcn/ui eingerichtet (`components.json`).
Anmeldung über Keycloak angebunden, Aufrufe ans Backend laufen über `src/lib/api.ts`.
Die Seiteninhalte kommen noch aus `src/mocks`.
