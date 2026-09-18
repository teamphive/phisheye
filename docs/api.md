# API

Was das Frontend braucht. Die Feldnamen stammen aus den Typen in `frontend/src/mocks`, die Regeln aus [site-structure.md](site-structure.md).

## Konventionen

- Der Team-Kontext kommt aus der Sitzung. Kein Pfad enthält eine Team-ID.
- Zeiten als ISO 8601 in UTC.
- Feldnamen in snake_case. Das Frontend wandelt sie beim Empfang zentral in camelCase um.
- Fehler als einheitliches Objekt, nicht als FastAPIs `detail`.
- Löschen ist weich, harte Löschung nach 10 Tagen.

## Anmeldung

Die Anmeldung läuft über Keycloak, nicht über die API. Das Frontend holt sich dort ein Token und schickt es bei jedem Aufruf mit:

```http
Authorization: Bearer <access token>
```

Das Backend prüft die Signatur gegen die öffentlichen Schlüssel des Realms unter `/realms/phisheye/protocol/openid-connect/certs`. Ein Aufruf ohne gültiges Token wird mit 401 abgelehnt, ein Token mit zu schwacher Rolle mit 403. Das Frontend zeigt 403 als fehlende Berechtigung an und meldet niemanden ab.

Das Feld `sub` im Token ist die Keycloak-ID des Nutzers, nicht seine ID in unserer Datenbank. Beim ersten Aufruf muss das Backend den Nutzer anlegen und die beiden IDs verbinden.

Endpunkte unter `/auth/` entfallen damit.

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
| POST | `/analyses` | Upload einer `.eml` oder `.msg` als Feld `file` (multipart), startet den Job, antwortet mit dem Listeneintrag |
| GET | `/analyses/{id}` | Detail |
| DELETE | `/analyses/{id}` | Weich löschen, nur Admin |
| POST | `/analyses/{id}/decision` | Verdikt bestätigen oder als falsch-positiv melden, Body `verdict` |
| DELETE | `/analyses/{id}/decision` | Entscheidung zurücknehmen |
| GET | `/analyses/search` | Suche über Absender, Domain, Hash und Betreff |
| GET | `/queue` | Wartende Jobs und Worker-Auslastung, für die Fortschrittsanzeige |

## Team

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/team` | Mitglieder mit Rolle und Beitrittsdatum |
| POST | `/teams` | Team anlegen |
| PATCH | `/team` | Umbenennen, nur Admin |
| DELETE | `/team` | Weich löschen, nur Admin |
| POST | `/team/invitations` | Einladen, Body `email` und `role` |
| PATCH | `/team/invitations/{id}` | Rolle einer offenen Einladung ändern, Body `role` |
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
| POST | `/monitoring/jobs/{id}/retry` | Fehlgeschlagenen Job neu einreihen, nur für `is_operator` |

Liefert Warteschlange, Worker, Fehlerrate und das VirusTotal-Kontingent. Die Fehlerliste enthält keine Mailinhalte. Das Frontend fragt alle 10 Sekunden neu.

## Konto

Passwort, zweiter Faktor, Backup-Codes und angemeldete Geräte verwaltet Keycloak in seiner eigenen Konsole. Dafür braucht die API keine Endpunkte.

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
| criteria | Liste aus `name`, `finding`, `weight` | alle vier Prüfungen aus [detection-criteria.md](detection-criteria.md), nicht ausgelöste mit `weight` 0 |
| criteria_total | number | Summe der Gewichte, bei 100 gekappt |
| links | Liste aus `text`, `target`, `finding`, `tone` | |
| attachments | Liste, siehe unten | |
| raw_headers | text | |
| decision | `{ verdict, by, at }` oder null | |
| duration_seconds | number oder null | |
| step | string oder null | nur solange `status` `running` ist |
| started_at | timestamp oder null | dito |
| error | `{ detail, step, attempt, max_attempts, at }` oder null | nur bei `failed` |

Ein Anhang besteht aus `filename`, `size` (Bytes), `detected_type`, `type_mismatch`, `sha256` (voller Hash), `virus_total` und `malicious`.

Solange `status` `running` ist, fragt das Frontend `GET /analyses/{id}` und `GET /queue` alle 3 Sekunden neu.

`GET /queue`:

| Feld | Typ | Beschreibung |
|---|---|---|
| waiting | number | alle wartenden Jobs, auch die anderer Teams |
| workers_busy | number | |
| workers_total | number | |
| items | Liste aus `position`, `subject`, `sender`, `submitted_by`, `queued_at` | nur Jobs des aktiven Teams, Mails anderer Teams erscheinen nur in `waiting` |

`GET /monitoring`:

| Feld | Typ | Beschreibung |
|---|---|---|
| queue | `{ waiting }` | |
| workers | `{ busy, total }` | |
| jobs | `{ failed, total }` | letzte 24 Stunden, daraus rechnet das Frontend die Fehlerrate |
| virus_total | `{ used, limit }` | Kontingent des Tages |
| hourly | Liste aus `hour`, `count` | 24 Einträge, älteste zuerst, `hour` ist der Beginn der Stunde |
| services | Liste aus `name`, `status`, `latency_ms` | `status` ist `ok`, `degraded` oder `down`, `latency_ms` null wenn keine Antwort |
| failures | Liste aus `id`, `error`, `attempt`, `max_attempts`, `at` | fehlgeschlagene Jobs der letzten 24 Stunden, ohne Mailinhalte |

## Offen

- IDs als UUID oder laufende Nummer.
- Abbrechen einer laufenden Analyse. Die Oberfläche hat den Knopf, ein Endpunkt fehlt noch.
