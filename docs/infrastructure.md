# Infrastruktur

## Entscheidungen

| Thema | Entscheidung | Grund |
| --- | --- | --- |
| IaC | OpenTofu | Community-Fork von Terraform, gleiche Syntax |
| State | S3 + DynamoDB | GitHub hat kein State-Backend. Bootstrap einmalig mit lokalem State, die State-Datei kommt nicht ins Git |
| Hosting | Homelab statt AWS | Proxmox-VM `neuserphis1c` mit Docker Compose. AWS nur noch fürs Budget |
| Zugriff für Kollegen und CI | Tailscale statt offenem SSH | Kein Port am Router, GitHub Actions klinkt sich per `tailscale/github-action` ins Tailnet |
| Reverse Proxy | Nginx Proxy Manager im Homelab | Läuft schon, TLS über Let's Encrypt. Am Router nur 80 und 443 offen |
| Deployment | GitHub Actions + SSH + Compose | Bei Merge in `main`: Images bauen, nach GHCR, per SSH `docker compose pull && up -d` |
| Registry | GHCR statt ECR | Team nutzt GitHub, kostenlos |
| DNS | Manuell beim bestehenden Provider | Domain gab es schon, Eintrag zeigt auf die Homelab-IP |
| KI | JEV statt AWS Bedrock | Feste Antwort mit Konfidenz, kein Freitext. Siehe [ai-assessment.md](ai-assessment.md) |
| Budget | $50 im Monat | Warnung bei 50, 80 und 100 % per Mail |

JEV: Der Key liegt als `TYPESAFE_API_KEY` in der `.env` auf dem Server. Der IAM-User für Bedrock ist aus `infra/main` entfernt und verschwindet beim nächsten `tofu apply`. Über AWS laufen nur noch State-Bucket, Lock-Tabelle und Budget.

## Monitoring

Grafana für Technik, die App für KPIs.

- **App** (`GET /monitoring`): Queue, Worker, Fehlerrate, Analysen pro Stunde, VirusTotal-Kontingent, Dienste-Ampel, Fehlerliste mit Retry.
- **Grafana**: Verlauf, Infrastruktur, Alarme.
- Der Stack (Prometheus, Grafana, Loki, Blackbox, ntfy) liegt im Repo `monitoring-stack` auf eigenem Host.
- Er holt von der VM: `node_exporter`, cAdvisor, Redis (mit Länge der arq-Queue), Postgres und Backend-Metriken. Alloy schickt die Logs an Loki.
- Backend-Metriken laufen über Port 9101, nicht unter `/api/metrics`.
- Einrichtung der Exporter: [deployment/monitoring](../deployment/monitoring/README.md).

## Keycloak

### Realm-Vorlage

`docker/keycloak/realm-export.json` ist eine Vorlage. Beim Start ersetzt `docker/keycloak/entrypoint.sh` die Marken aus der Umgebung des Containers:

| Marke | Variable | Zweck |
| --- | --- | --- |
| `__FRONTEND_URL__` | `FRONTEND_URL` | Frontend-Adresse, erlaubtes Ziel nach Login und Logout |
| `__SMTP_HOST__`, `__SMTP_PORT__` | `SMTP_HOST`, `SMTP_PORT` | Mailserver |
| `__SMTP_USERNAME__`, `__SMTP_PASSWORD__` | `SMTP_USERNAME`, `SMTP_PASSWORD` | Zugang und Absender |

Eigene Marken, weil Keycloak `${env.SMTP_USERNAME}` im Block `smtpServer` nicht auflöst und nicht startet.

- `FRONTEND_URL` mit Schema, ohne Slash am Ende: `https://phisheye.neumann-it.org`.
- Nach einem Neuexport aus der Admin-Console die Werte wieder durch Marken ersetzen.
- Der Import läuft nur beim ersten Start mit leerem Volume. Bei bestehendem Realm in der Admin-Console nachziehen oder das Volume `keycloak-data` neu anlegen.

### Öffentlich unter `/auth`

Eine Domain reicht, der Nginx Proxy Manager gibt nur das Frontend frei.

- Keycloak läuft mit `KC_HTTP_RELATIVE_PATH=/auth`. Der Frontend-nginx reicht `/auth/` weiter (`frontend/nginx.conf`).
- Keycloak ist nie direkt aus dem Internet erreichbar.
- Produktionsmodus (`start --optimized`). Pfad `/auth` und Datenbank (H2-Datei im Volume `keycloak-data`) sind Build-Optionen und stecken im Image (Stage `keycloak` in `frontend/Dockerfile`). Änderungen wirken erst nach neuem Build, Werte in `docker-compose.yml` werden ignoriert.
- `KEYCLOAK_URL` und `KEYCLOAK_PUBLIC_URL` bleiben pfadlos. Das Backend hängt `/auth` selbst an (`backend/app/services/auth.py`), Compose nur für `KC_HOSTNAME` und den Frontend-Build.
- Admin-Console: `https://phisheye.neumann-it.org/auth/admin/`, bewusst öffentlich. Schutz über starkes Passwort und 2FA, nicht über Netzwerksperren.
- Port `8080` ist nur als SSH-Tunnel-Fallback an `127.0.0.1` gebunden.

### Konten für Eingeladene

Das Backend legt für Eingeladene ein Konto ohne Passwort an. Keycloak mailt den Link zum Setzen.

- Client: `phisheye-backend-admin` (Service-Account mit `view-users`, `query-users`, `manage-users`). ID und Secret stehen in der `.env`.
- Neue Realms bekommen den Client beim Import.
- Bestehender Realm, einmal von Hand: Clients, Create, Client ID `phisheye-backend-admin`, Client authentication an, Service accounts roles an. Secret unter Credentials in die `.env`. Unter Service accounts roles die drei Rollen aus `realm-management` zuweisen.
- Ohne Secret geht nur die Einladungsmail raus, das Konto muss dann existieren.
- Mails laufen über den SMTP-Server aus dem Realm (`SMTP_*`).
- Mail-Design: Email-Theme `phisheye-email` in `frontend/email-theme/`, steckt im Image. Neue Realms nutzen es über die Vorlage. Bestehender Realm: Realm settings, Themes, Email theme. `just seed` setzt es lokal.

## Standard-Team und Instanz-Admin

- Das Standard-Team gibt es immer. Name fest (`Standard-Team`), nicht umbenennbar, nicht löschbar.
- Es nimmt Meldungen von Domains auf, die kein Team eingetragen hat.
- Rollen dort: nur Admin und Auditor. Beide sind **Instanz-Rollen** und sehen alle Teams.
- Admin darf überall ändern und Teams erstellen, Auditor liest nur.
- Der Instanz-Admin ist automatisch Operator und sieht das Monitoring.

Datenschutz: Beide Rollen sehen die Mails aller Teams. Auf wenige Personen begrenzen. Das Backend protokolliert, wenn ein Instanz-Mitglied ein fremdes Team betritt. Im Abschlussbericht erwähnen.

Erster Instanz-Admin auf dem Server:

1. In der `.env`: `PHISHEYE_ADMIN_EMAIL=<deine Adresse>`.
2. Einmal ausführen: `docker compose --profile app exec backend python -m scripts.bootstrap_admin`. Das Skript legt das Konto in Keycloak an und schickt den Link zum Passwort-Setzen.
3. Nach der Anmeldung ist die Adresse Admin im Standard-Team (nur bei bestätigter E-Mail).

Weitere Instanz-Admins und -Auditoren lädt der erste Admin im Standard-Team ein. Lokal legt `just seed` beide an.

## Konfiguration

### Eine `.env` für alles

- Backend, Worker, Migration und Compose lesen dieselbe `.env` im Root.
- Eine zweite `backend/.env` gibt es nicht mehr. Abweichende Werte (zum Beispiel `POSTGRES_PASSWORD`) ließen die Anmeldung an Postgres scheitern, ohne dass man die Ursache sah.
- Ohne Docker (`just dev`) sucht `python-dotenv` ab `backend/app/database.py` aufwärts die nächste `.env`.

### Adressen lokal und auf dem Server

Lokal laufen die Standardwerte ohne Einträge. Auf dem Server gehören diese Werte in die `.env`:

| Variable | Lokal (Standard) | Server | Wirkung |
| --- | --- | --- | --- |
| `KEYCLOAK_PUBLIC_URL` | `http://localhost:8080` | `https://phisheye.neumann-it.org` | Keycloak-Adresse im Browser, ohne `/auth` und Slash am Ende. Steht als Aussteller in jedem Token (`KC_HOSTNAME`), das Backend prüft sie |
| `FRONTEND_URL` | `http://localhost:5173` | `https://phisheye.neumann-it.org` | erlaubtes Ziel nach Login und Logout, gilt nur beim ersten Import |
| `FRONTEND_PORT` | `5173` | Port, auf den der Nginx Proxy Manager zeigt | veröffentlichter Frontend-Port |

Das Frontend liest `KEYCLOAK_PUBLIC_URL` beim Build. Bei Änderung neu bauen: `docker compose --profile app up -d --build`.
