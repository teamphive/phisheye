# Infrastructure Decisions

## IaC: OpenTofu

Community-Fork von Terraform, Syntax identisch.

## State: S3 + DynamoDB

GitHub hat kein natives State-Backend. Bootstrap (Bucket + Lock-Tabelle) läuft einmalig mit lokalem State, Code geht ins Git, die State-Datei selbst nicht.

## Kurswechsel: Homelab statt AWS-Compute

Ursprünglich war die App komplett auf AWS geplant (ECS/Fargate, RDS, ElastiCache, S3+CloudFront). Entschieden, stattdessen alles im eigenen Homelab zu hosten (Proxmox-VM `neuserphis1c`, Docker Compose mit Backend, Frontend, Postgres, Redis, arq-Worker). AWS wird nur noch für Bedrock (LLM-Anbindung) und Kostenüberwachung (Budget) genutzt.

## Zugriff Kollegen/CI: Tailscale statt offenem SSH

Kein offener Port am Router nötig, VM ist im Internet nicht als SSH-Ziel sichtbar. GitHub Actions nutzt die offizielle `tailscale/github-action`, um sich fürs Deployment temporär ins Tailnet einzuklinken.

## Reverse Proxy: Nginx Proxy Manager im Homelab statt AWS

Kein Umweg über AWS nötig, NPM läuft bereits im Homelab, terminiert TLS (Let's Encrypt) und routet zum phisheye-Docker-Compose-Stack. Nur Port 80/443 werden am Router freigegeben, SSH bleibt zu.

## Auto-Deployment: GitHub Actions + SSH + Docker Compose

Bei Merge in main: Images bauen, zu GHCR pushen, per SSH auf die VM verbinden, `docker compose pull && up -d`.

## Registry: GHCR statt ECR

Team nutzt eh GitHub, kostenlos, kein zusätzlicher AWS-Service nötig.

## Keycloak-Realm: Vorlage mit Marken

`docker/keycloak/realm-export.json` ist eine Vorlage. Beim Start ersetzt `docker/keycloak/entrypoint.sh` die Marken aus der Umgebung des Containers:

| Marke | Variable | Zweck |
| --- | --- | --- |
| `__FRONTEND_URL__` | `FRONTEND_URL` | öffentliche Adresse des Frontends, erlaubtes Ziel nach Login und Logout |
| `__SMTP_HOST__`, `__SMTP_PORT__` | `SMTP_HOST`, `SMTP_PORT` | Mailserver für Keycloak-Mails |
| `__SMTP_USERNAME__`, `__SMTP_PASSWORD__` | `SMTP_USERNAME`, `SMTP_PASSWORD` | Zugang und Absender |

Keycloak löst Platzhalter der Form `${env.SMTP_USERNAME}` im Block `smtpServer` nicht auf und startet dann nicht. Deshalb gibt es die eigenen Marken.

- `FRONTEND_URL` mit Schema, ohne Slash am Ende: `https://phisheye.neumann-it.org`.
- Nach einem Neuexport aus der Admin-Console die Werte wieder durch die Marken ersetzen.
- Der Import läuft nur beim ersten Start mit leerem Volume. Bei einem bestehenden Realm die Werte in der Admin-Console nachziehen oder das Volume `keycloak-data` neu anlegen.

## Keycloak öffentlich unter /auth statt eigener Subdomain

Der Nginx Proxy Manager gibt nur das Frontend frei, eine Domain reicht. Keycloak läuft mit `KC_HTTP_RELATIVE_PATH=/auth`, der Frontend-nginx reicht `/auth/` unverändert an den Keycloak-Container weiter (`frontend/nginx.conf`). Keycloak selbst ist so nie direkt aus dem Internet erreichbar, nur über diese Route.

Keycloak startet im Produktionsmodus (`start --optimized`). Pfad `/auth` und Datenbank (H2-Datei im Volume `keycloak-data`) sind Build-Optionen und stecken im Image (Stage `keycloak` in `frontend/Dockerfile`). Eine Änderung daran wirkt erst nach einem neuen Build des Images, ein anderer Wert in `docker-compose.yml` wird ignoriert.

Folge: `KEYCLOAK_URL` und `KEYCLOAK_PUBLIC_URL` bleiben überall pfadlos (lokal, `just dev` und Compose). Das Backend hängt `/auth` selbst an (`backend/app/services/auth.py`). Compose ergänzt es nur für `KC_HOSTNAME` und den Frontend-Build.

Die Admin-Console läuft unter `https://phisheye.neumann-it.org/auth/admin/`, öffentlich erreichbar, bewusst so entschieden. Absicherung über starkes Passwort und 2FA am Admin-Konto, nicht über Netzwerksperren. Port `8080` bleibt nur noch für einen SSH-Tunnel als Fallback an `127.0.0.1` gebunden, kein regulärer Zugangsweg.

## Konten für Eingeladene

Das Backend legt für eingeladene Personen ein Konto in Keycloak an, ohne Passwort. Keycloak mailt einen Link zum Setzen. Dafür nutzt das Backend den Client `phisheye-backend-admin` (Service-Account mit `view-users`, `query-users` und `manage-users`). ID und Secret stehen in der `.env`.

- Neue Realms bekommen den Client beim ersten Import.
- Bei einem bestehenden Realm den Client einmal von Hand anlegen: Clients, Create, Client ID `phisheye-backend-admin`, Client authentication an, Service accounts roles an. Das Secret unter Credentials in die `.env` kopieren. Unter Service accounts roles die drei Rollen aus `realm-management` zuweisen.
- Ohne Secret geht nur die Einladungsmail raus, das Konto muss dann schon existieren.
- Keycloak mailt über den SMTP-Server aus dem Realm (`SMTP_*`).

## Eine `.env` für alles

Backend, Worker, Migration und Docker Compose selbst lesen alle dieselbe `.env` im Root. Vorher gab es zusätzlich `backend/.env`, mit teils denselben Variablen. Weichten die Werte voneinander ab, zum Beispiel `POSTGRES_PASSWORD`, schlug die Anmeldung an Postgres fehl, ohne dass die Ursache in der Compose-Konfiguration selbst zu sehen war. Lokal ohne Docker (`just dev`) findet `python-dotenv` die Root-`.env` automatisch, sie sucht beim Start von `backend/app/database.py` aufwärts nach der nächsten `.env`.

## Adressen lokal und auf dem Server

Die Standardwerte laufen lokal auf dem Mac ohne eigene `.env`-Einträge. Auf dem Server gehören diese Werte in die `.env`:

| Variable | Lokal (Standard) | Server | Wirkung |
| --- | --- | --- | --- |
| `KEYCLOAK_PUBLIC_URL` | `http://localhost:8080` | `https://phisheye.neumann-it.org` | Adresse von Keycloak im Browser, ohne `/auth` und ohne Slash am Ende. Keycloak trägt sie als Aussteller in jedes Token ein (`KC_HOSTNAME`), das Backend prüft sie, das Frontend meldet sich dort an. |
| `FRONTEND_URL` | `http://localhost:5173` | `https://phisheye.neumann-it.org` | erlaubtes Ziel nach Login und Logout, gilt nur beim ersten Import des Realms |
| `FRONTEND_PORT` | `5173` | Port, auf den der Nginx Proxy Manager zeigt | veröffentlichter Port des Frontends |

Das Frontend liest `KEYCLOAK_PUBLIC_URL` beim Build. Ändert sich der Wert, muss es neu gebaut werden (`docker compose --profile app up -d --build`).

## DNS: manuell beim bestehenden Provider

Domain existiert bereits extern, Eintrag zeigt auf die Homelab-IP.

## AWS Bedrock: eigener IAM-User statt persönlicher Credentials

Minimal berechtigter IAM-User nur mit `bedrock:InvokeModel`-Rechten, damit das Backend nicht mit persönlichen Admin-Credentials arbeitet.

## Budget-Überwachung: monatliches Limit mit gestaffelten Alerts

$50/Monat, Warnungen bei 50/80/100% per E-Mail. Deckt nur noch die Bedrock-Nutzung ab, da sonst nichts mehr über AWS läuft.
