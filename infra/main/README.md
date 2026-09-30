# AWS Ressourcen

IaC für den AWS-Teil von phisheye via OpenTofu. Deckt nur noch die Kostenüberwachung ab, siehe [infrastructure.md](../../docs/infrastructure.md) für die Begründung des Architekturwechsels.

## Techstack

- **App-Betrieb:** komplett im Homelab (Proxmox-VM `neuserphis1c`), Docker Compose mit Backend, Frontend, Postgres, Redis, arq-Worker
- **Zugriff Kollegen/CI:** Tailscale (kein offener SSH-Port)
- **Reverse Proxy:** Nginx Proxy Manager im Homelab (TLS via Let's Encrypt)
- **AWS:** nur noch Budget-Überwachung, die KI läuft über JEV von TypeSafe statt über Bedrock

## Voraussetzungen

- `tofu` installiert
- AWS-Credentials konfiguriert (`aws configure`, siehe `setup.md` im Root)
- Bootstrap (S3-Backend + DynamoDB-Lock) muss vorher einmalig laufen, siehe `infra/bootstrap/`

## Ausführen

```bash
cd infra/main
tofu init
tofu plan
tofu apply
```

## Stand

- [x] Budget-Überwachung (monatlich, gestaffelte Alerts)

## Hinweis

Netzwerk, Security Groups, RDS, ElastiCache, ECS/ALB/CloudFront und der IAM-User für Bedrock wurden verworfen, die App läuft jetzt komplett im Homelab. Details siehe [infrastructure.md](../../docs/infrastructure.md).
