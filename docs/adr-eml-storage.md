# ADR: Ablage der `.eml`-Dateien

- Datum: 2026-09-18
- Beteiligte: Oliver Neumann
- Stand: umgesetzt. Die Detailseite lädt die Datei über das Backend (`GET /analyses/{id}/eml`), gelöscht wird sie 10 Tage nach dem Löschen der Analyse.

## Kontext

Die `.eml` einer gemeldeten Mail wird aktuell nur zur Laufzeit verarbeitet und danach verworfen. Postgres speichert nur Metadaten (Subject, Sender, Status) und Anhang-Hashes. Für die geplante Detailansicht (Rohdaten-Tab, Original herunterladen) fehlt die Datei.

Eine `.eml` kann einen schädlichen Anhang enthalten. Die Ablage muss das berücksichtigen, nicht nur Speicherort und Suche.

## Entscheidung

Original-.eml-Dateien liegen in MinIO (S3-kompatibler Objektspeicher, eigener Container), nicht im Filesystem der App-VM und nicht als Blob in Postgres. Postgres speichert nur eine Referenz (UUID/Key) pro Analyse.

MinIO läuft als eigener Container in der Compose-Datei. Zugriff läuft über eine Python-S3-Lib (boto3 oder minio), kein eigener Code für Pfade oder Ordnerstruktur.

## Alternativen

### Filesystem auf der VM -> verworfen

Keine saubere Trennung von App-Code und potenziell schädlichen Dateien. Ein Fehler beim Zugriff (falscher Pfad, fehlende Rechteprüfung) ist ein Risiko fürs ganze System, weil beides im selben Dateisystem liegt. Kein eingebautes Zugriffs-/Rechtekonzept, das müsste komplett selbst gebaut werden.

### Blob in Postgres -> verworfen

Bläht DB und Backups auf, ohne Vorteil gegenüber Objektspeicher.

## Konsequenzen

- Positiv: schädliche Anhänge liegen isoliert vom App-Code, in einem eigenen Container mit eigenem Volume. Setup ist gering: ein Container plus eine Lib, kein eigener Storage-Code.
- Negativ oder Kosten: ein zusätzlicher Container, mehr zu dokumentieren und zu betreiben.
- Folgeaufgaben: MinIO-Container in Compose ergänzen. Spalte für den Storage-Key (UUID) an `mail_analyses`. Zugriffsrechte auf den Bucket festlegen.
