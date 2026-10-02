# Techstack

## Architektur

```mermaid
flowchart TB
    Browser --> Nginx

    subgraph Frontend
        Nginx["nginx + React"]
    end

    Nginx -->|"/auth"| Keycloak
    Nginx -->|"/api"| Backend

    subgraph Backend-Seite
        Backend["Backend (FastAPI)"]
        Worker["Worker (arq)"]
    end

    subgraph Daten
        Postgres[(PostgreSQL)]
        MinIO[(MinIO)]
        Redis[(Redis)]
        KCData[(Keycloak-Daten)]
    end

    subgraph Extern
        VT[VirusTotal]
        JEV["JEV (KI)"]
    end

    Keycloak --> KCData
    Backend -->|"Token prüfen, Nutzer verwalten"| Keycloak
    Backend --> Postgres
    Backend --> MinIO
    Backend --> Redis
    Redis --> Worker
    Worker --> Postgres
    Worker --> MinIO
    Worker --> VT
    Worker --> JEV
```

## Ablauf einer Analyse

Zielbild. Stand heute läuft die Analyse noch synchron im Request, Worker, Regeln und KI kommen nach, siehe [API](api.md).

```mermaid
sequenceDiagram
    actor U as Nutzer
    participant F as Frontend
    participant B as Backend
    participant R as Redis
    participant W as Worker
    participant X as VirusTotal und JEV

    U->>F: .eml hochladen
    F->>B: POST /api/analyses
    B->>B: EML in MinIO ablegen
    B->>R: Job einreihen
    B-->>F: Analyse läuft
    R->>W: Job holen
    W->>W: Regeln auf Header und Metadaten
    W->>X: Hashes und Mailtext prüfen
    X-->>W: Reputation und KI-Einschätzung
    W->>B: Verdikt und Score speichern
    F->>B: Ergebnis abfragen
    B-->>F: Verdikt mit Gründen
```

## Bausteine

| Technik | Zweck | Warum |
| --- | --- | --- |
| React, TypeScript, Vite | Oberfläche | Typen fangen Fehler früh ab, schneller Dev-Server |
| Tailwind, shadcn/ui | Styling und Komponenten | Komponenten liegen im eigenen Code und lassen sich anpassen |
| nginx | Auslieferung, Proxy für `/api` und `/auth` | Ein Host für alles, kein CORS |
| FastAPI | REST-API | Async, Validierung und OpenAPI eingebaut |
| SQLModel, Alembic | Modelle und Migrationen | Ein Modell für Datenbank und API |
| PostgreSQL | Analysen, Teams, Nutzer | Relationale Daten mit klaren Beziehungen |
| MinIO (S3) | Ablage der EML-Dateien | Schädliche Dateien getrennt von der App, eigenes Rechtekonzept, siehe [ADR](adr-eml-storage.md) |
| arq, Redis | Analyse im Hintergrund | Der Request bleibt schnell, leichtgewichtig und async wie FastAPI |
| Keycloak, Keycloakify | Login, Rollen, Zwei-Faktor | Fertige Nutzerverwaltung statt Eigenbau, eigenes Login-Theme |
| VirusTotal | Reputation von Anhängen | Hash-Abfrage ohne den Anhang selbst hochzuladen |
| JEV (TypeSafe) | KI-Einschätzung des Mailtexts | Feste Antwort mit Konfidenz statt Freitext, siehe [KI-Einschätzung](ai-assessment.md) |
| Docker Compose | Betrieb | Ein Stack lokal und auf dem Server |
| Homelab, Nginx Proxy Manager | Hosting und Reverse Proxy | Kostenlos und volle Kontrolle, AWS nur für das Budget, siehe [Infrastruktur](infrastructure.md) |
| GitHub Actions, GHCR | CI/CD und Images | Direkt am Repo, siehe [Release](release.md) |
