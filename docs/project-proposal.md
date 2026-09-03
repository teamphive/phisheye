# Projektidee: phisheye

## Problem

Mitarbeiter melden vermeintliche Phishing-Mails, die Cyber Security Abteilung bekommt diese als Ticket bzw. Weiterleitung und muss sie manuell prüfen. Es gibt keinen zentralen Ort im Unternehmen, an dem diese Prüfungen dokumentiert und nachvollziehbar gemacht werden.

## Idee

phisheye ist eine Web-App, in die eine verdächtige Mail hochgeladen wird. Header und Metadaten werden mit deterministischen Regeln geprüft (siehe [detection-criteria.md](detection-criteria.md)), die Anhang-Hashes gegen die VirusTotal-API. Das Ergebnis ist ein Verdikt mit Score: sauber, verdächtig oder Phishing.

Die App läuft im Unternehmenskontext mit Teamverwaltung, sodass die Cyber Security Abteilung zentral und nachvollziehbar arbeiten kann statt Prüfungen manuell im Ticket-System zu dokumentieren.

## Zielgruppe

Firmenintern, Cyber Security Abteilung als Hauptnutzer. Mitarbeiter melden Mails, das Security-Team prüft und dokumentiert zentral.

## KI-Integration

Neben den deterministischen Regeln wertet ein Sprachmodell den Text der Mail aus. Es beurteilt die Sprache auf Muster, die sich nicht in Regeln fassen lassen, etwa Zeitdruck, Drohungen oder Aufforderungen zur Herausgabe von Zugangsdaten, und liefert daraus eine eigene Einschätzung zum Verdikt.

Wie das technisch umgesetzt wird, ist noch offen.

## Wahlpflicht-Features

| # | Feature | Punkte |
|---|---------|--------|
| 1 | KI-Integration | 2 |
| 2 | Team-Feature inkl. Rollenverwaltung | 2 |
| 3 | Benachrichtigungs-System | 2 |
| 4 | Such-System | 2 |
| 5 | Background-Jobs | 1 |
| 6 | Anbindung an externe APIs | 1 |
| 7 | Zwei-Faktor-Authentifizierung | 1 |
| 8 | Monitoring-System | 1 |
| | **Summe** | **12** |

Details und die Pflicht-Features stehen in [features.md](features.md).

## Datenbankschema

Tabellen und Entity-Relationship-Modell stehen in [data-model.md](data-model.md).
