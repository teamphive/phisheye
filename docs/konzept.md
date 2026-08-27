# phisheye: Konzept

## Problem

Mitarbeiter melden vermeintliche Phishing-Mails, Cyber Security Abteilung bekommt diese als Ticket/weitergeleitet und muss die manuell checken. Kein zentraler Ort im Unternehmen, an dem sowas geprüft und dokumentiert wird.

## Idee

Web-App, in die man eine Mail reinwirft (Upload oder per IMAP/Forwarding rein), die dann Header, Metadaten und Attachment-Hashes gegen VirusTotal checkt und als Ergebnis True/False (Phishing ja/nein) plus Confidence Score ausspuckt.

Läuft im Unternehmenskontext, mit Teamverwaltung, damit mehrere Leute/Abteilungen das gemeinsam nutzen und Ergebnisse einsehen können.

## Zielgruppe

Firmenintern, Cyber Security Abteilung als Hauptnutzer. Mitarbeiter melden Mails, Security-Team checkt und dokumentiert die zentral statt manuell im Ticket-Wirrwarr.

## Kernablauf

1. Mail rein (Upload `.eml` oder IMAP/Forwarding)
2. Parsing: Header, Metadaten, Attachments extrahieren
3. Hashes berechnen, gegen VirusTotal-API checken
4. Scoring-Logik -> Confidence Score berechnen
5. Ergebnis speichern, im Team sichtbar machen

## Techstack (Kurzfassung, siehe techstack.md für Details)

- Backend: FastAPI
- Frontend: React + TypeScript (Vite)
- DB: PostgreSQL
- Deploy: Docker Compose, self-hosted

## Offene Punkte

- Datenmodell im Detail (datenmodell.md)
