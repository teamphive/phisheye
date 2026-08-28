# Infrastructure Decisions

## IaC: OpenTofu

Community-Fork von Terraform, Syntax identisch.

## State: S3 + DynamoDB

GitHub hat kein natives State-Backend. Bootstrap (Bucket + Lock-Tabelle) läuft einmalig mit lokalem State, Code geht ins Git, die State-Datei selbst nicht.

## Compute: ECS/Fargate statt EC2

Wegen Auto-Deployment (main -> live) mit Zero-Downtime und Rollback. Mehr Aufwand als reines EC2 + Docker Compose, aber sauberere Trennung.

## DB: RDS statt Postgres-Container

Fargate hat keinen persistenten Storage, Container-Postgres würde bei jedem Neustart alle Daten verlieren.

## Queue: ElastiCache statt Redis-Container

Gleicher Grund wie bei RDS, arq-Jobs würden sonst bei Neustarts verloren gehen.

## Frontend: S3 + CloudFront statt Container

React-Build ist statisch, eigener Fargate-Task dafür wäre unnötiger Overhead.

## Registry: GHCR statt ECR

Team nutzt eh GitHub, kostenlos, kein zusätzlicher AWS-Service nötig.

## DNS: manuell beim bestehenden Provider statt Route53

Domain existiert schon extern, Migration lohnt sich nicht.

## Netzwerk: eigenes VPC statt Default-VPC

RDS/ElastiCache/ALB brauchen Subnet Groups über mind. 2 AZs (öffentlich + privat), das geht mit der Default-VPC nicht sauber.
