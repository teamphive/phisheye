# API

Was das Frontend braucht. Die Feldnamen stammen aus den Typen in `frontend/src/mocks`, die Regeln aus [site-structure.md](site-structure.md).

## Konventionen

- Der Team-Kontext kommt aus der Sitzung. Kein Pfad enthält eine Team-ID.
- Zeiten als ISO 8601 in UTC.
- Fehler als einheitliches Objekt, nicht als FastAPIs `detail`.
- Löschen ist weich, harte Löschung nach 10 Tagen.

## Zugang

| Methode | Pfad | Body | Zweck |
|---|---|---|---|
| POST | `/auth/login` | `email`, `password` | Prüft das Passwort, verlangt danach 2FA |
| POST | `/auth/2fa` | `code` | Schließt die Anmeldung ab |
| POST | `/auth/logout` | — | Beendet die Sitzung auf diesem Gerät |
| POST | `/auth/register` | `token`, `name`, `email`, `password` | Nur über Einladungslink |
| POST | `/auth/password/forgot` | `email` | Verschickt den Link |
| POST | `/auth/password/reset` | `token`, `password` | Setzt das neue Passwort |

Ohne Einladung gibt es kein Konto. Der erste Admin wird beim Initialisieren des Backends angelegt.

## Sitzung

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/me` | Angemeldeter Nutzer, seine Teams und die aktive Rolle |
| POST | `/me/team` | Wechselt den Team-Kontext, Body `team_id` |
| PATCH | `/me` | Ändert den Anzeigenamen |

`GET /me` liefert `name`, `email`, `initials`, `is_operator` sowie die Teams mit `id`, `name`, `member_count` und `role`.

## Analysen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/analyses` | Liste für das aktive Team |
| POST | `/analyses` | Upload einer `.eml` oder `.msg`, startet den Job |
| GET | `/analyses/{id}` | Detail |
| DELETE | `/analyses/{id}` | Weich löschen, nur Admin |
| POST | `/analyses/{id}/decision` | Verdikt bestätigen oder als falsch-positiv melden, Body `verdict` |
| DELETE | `/analyses/{id}/decision` | Entscheidung zurücknehmen |
| GET | `/analyses/search` | Suche über Absender, Domain, Hash und Betreff |
| GET | `/queue` | Wartende Jobs, für die Fortschrittsanzeige |

## Team

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/team` | Mitglieder mit Rolle und Beitrittsdatum |
| POST | `/teams` | Team anlegen |
| PATCH | `/team` | Umbenennen, nur Admin |
| DELETE | `/team` | Weich löschen, nur Admin |
| POST | `/team/invitations` | Einladen, Body `email` und `role` |
| DELETE | `/team/invitations/{id}` | Einladung zurückziehen |
| PATCH | `/team/members/{id}` | Rolle ändern |
| DELETE | `/team/members/{id}` | Entfernen, oder selbst verlassen |

Der letzte Admin kann sich weder herabstufen noch entfernen. Das Verlassen des letzten Teams wird abgelehnt.

## Benachrichtigungen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/notifications` | Liste, ungelesene zuerst |
| POST | `/notifications/read` | Als gelesen markieren, Body `ids` oder leer für alle |

## Monitoring

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/monitoring` | Systemweit über alle Teams, nur für `is_operator` |

Liefert Warteschlange, Worker, Fehlerrate und das VirusTotal-Kontingent. Die Fehlerliste enthält keine Mailinhalte.

## Konto

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/me/security` | Stand von Passwort, 2FA, Backup-Codes und Sitzungen |
| POST | `/me/password` | Body `current_password`, `new_password` |
| POST | `/me/2fa/setup` | Liefert Secret und QR-Code |
| POST | `/me/2fa/confirm` | Body `code`, aktiviert 2FA |
| DELETE | `/me/2fa` | Deaktiviert 2FA |
| POST | `/me/backup-codes` | Erzeugt neue Codes, alte werden ungültig |
| GET | `/me/sessions` | Geräte mit Ort, IP und letzter Aktivität |
| DELETE | `/me/sessions/{id}` | Einzelnes Gerät abmelden |
| DELETE | `/me/sessions` | Alle außer dem aktuellen abmelden |

Die Codes werden nur einmal ausgeliefert und danach nie wieder angezeigt.

## Antwortformen

`GET /analyses` je Eintrag:

| Feld | Typ |
|---|---|
| id | string |
| subject | string |
| sender | string |
| status | `running`, `completed`, `failed` |
| verdict | `clean`, `suspicious`, `phishing` oder null |
| score | 0 bis 100 oder null |
| handler | string |
| received_at | timestamp |

`GET /analyses/{id}` zusätzlich:

| Feld | Typ | Beschreibung |
|---|---|---|
| thresholds | `{ suspicious, phishing }` | Schwellen kommen vom Server, das Frontend rechnet nichts nach |
| criteria | Liste aus `name`, `finding`, `weight` | die vier Prüfungen aus [detection-criteria.md](detection-criteria.md) |
| criteria_total | number | Summe der Gewichte, bei 100 gekappt |
| links | Liste aus `text`, `target`, `finding`, `tone` | |
| attachments | Liste, siehe unten | |
| raw_headers | text | |
| decision | `{ verdict, by, at }` oder null | |
| duration_seconds | number oder null | |
| step | string oder null | nur solange `status` `running` ist |
| started_at | timestamp oder null | dito |
| error | `{ detail, step, attempt, max_attempts, at }` oder null | nur bei `failed` |

Ein Anhang besteht aus `filename`, `size`, `detected_type`, `type_mismatch`, `sha256`, `virus_total` und `malicious`.

## Offen

- Authentifizierung als Cookie oder Bearer-Token. Betrifft jeden Endpunkt.
- IDs als UUID oder laufende Nummer.
- Schreibweise der Felder. Das Frontend nutzt derzeit camelCase, oben steht snake_case.
