# AWS Ressourcen

IaC für die phisheye-Infrastruktur (ECS/Fargate-Architektur) via OpenTofu.

## Voraussetzungen

- `tofu` installiert
- AWS-Credentials konfiguriert (`aws configure`, siehe `docs/setup.md`)
- Bootstrap (S3-Backend + DynamoDB-Lock) muss vorher einmalig laufen, siehe `infra/bootstrap/`

## Ausführen

```bash
cd infra/main
tofu init
tofu plan
tofu apply
```

## Stand

- [x] Network (VPC, öffentliche/private Subnets, Internet Gateway, NAT Gateway, Route Tables)
- [x] Security Groups
- [x] RDS (Postgres)
- [x] ElastiCache (Redis)
- [ ] ECS Cluster + IAM Roles
- [ ] Task Definitions + Services (Backend, Worker)
- [ ] Application Load Balancer + ACM
- [ ] S3 + CloudFront (Frontend)

## Fahrplan

Reihenfolge, da spätere Schritte auf früheren aufbauen:

1. Network -> Fundament, alles andere hängt daran
2. Security Groups -> bevor Ressourcen angelegt werden, die sie brauchen
3. RDS (Postgres)
4. ElastiCache (Redis)
5. ECS Cluster + IAM Roles
6. Task Definitions + Services (Backend, Worker)
7. ALB + ACM
8. S3 + CloudFront (Frontend)

Container-Images kommen über GitHub Container Registry (GHCR), kein ECR nötig.
DNS läuft manuell über den bestehenden Domain-Provider (kein Route53).
