# Monitoring

Die Exporter für die VM. Prometheus, Grafana, Loki und die Alarme liegen im Repo `monitoring-stack` und holen die Werte hier ab. Was in Grafana liegt und was in der App, steht in [infrastructure.md](../../docs/infrastructure.md).

Dashboard (öffentlich, ohne Anmeldung): https://monitoring.neumann-it.org/public-dashboards/e9850289f0b04b848d87ed35522dbf8f

| Was | Port |
| --- | --- |
| Backend (Requests, Latenz, 5xx) | 9101 |
| cAdvisor (Container) | 8081 |
| Redis samt arq-Queue | 9121 |
| Postgres | 9187 |

## Einrichten auf der VM

In die `.env`:

```
METRICS_BIND=192.168.178.225
POSTGRES_MONITOR_PASSWORD=<openssl rand -base64 24>
```

Das Passwort darf Sonderzeichen enthalten (`/`, `+`, `=`), der Exporter bekommt Benutzer, Passwort und Adresse getrennt (`DATA_SOURCE_USER`, `DATA_SOURCE_PASS`, `DATA_SOURCE_URI`). Früher stand alles in einer URL, und ein `/` im Passwort ließ den Exporter mit "invalid port" scheitern.

Benutzer für Postgres anlegen:

```bash
docker exec -i postges psql -U phisheye -d phisheye -c \
  "create role phisheye_monitor login password '<POSTGRES_MONITOR_PASSWORD>'; grant pg_monitor to phisheye_monitor;"
```

Backend neu starten, Exporter starten, Firewall öffnen:

```bash
docker compose --profile app up -d backend
docker compose --project-directory . -f deployment/monitoring/docker-compose.yml up -d
sudo ufw allow from 192.168.178.236 to any port 8081,9101,9121,9187 proto tcp comment 'Prometheus'
```

Docker umgeht UFW. Aus dem Internet hält die Ports nur `METRICS_BIND` heraus.

## Prüfen

```bash
curl -s 192.168.178.225:9101/metrics | grep http_requests_total
curl -s 192.168.178.225:9121/metrics | grep redis_up
curl -s 192.168.178.225:9187/metrics | grep ^pg_up
curl -s 192.168.178.225:8081/metrics | grep -c ^container_
```

Danach in Prometheus unter Targets prüfen, ob alle Jobs `UP` sind. Jobs, Dashboard und Alarme stehen im `monitoring-stack`, eine Kopie des Dashboards liegt in [`grafana/phisheye.json`](grafana/phisheye.json).
