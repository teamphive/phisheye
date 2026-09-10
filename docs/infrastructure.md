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

## DNS: manuell beim bestehenden Provider

Domain existiert bereits extern, Eintrag zeigt auf die Homelab-IP.

## AWS Bedrock: eigener IAM-User statt persönlicher Credentials

Minimal berechtigter IAM-User nur mit `bedrock:InvokeModel`-Rechten, damit das Backend nicht mit persönlichen Admin-Credentials arbeitet.

## Budget-Überwachung: monatliches Limit mit gestaffelten Alerts

$50/Monat, Warnungen bei 50/80/100% per E-Mail. Deckt nur noch die Bedrock-Nutzung ab, da sonst nichts mehr über AWS läuft.
