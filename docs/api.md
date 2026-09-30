# API

Was das Frontend braucht. Die Feldnamen stammen aus den Typen in `frontend/src/mocks`, die Regeln aus [site-structure.md](site-structure.md).

## Konventionen

- Der Team-Kontext kommt aus der Sitzung. Kein Pfad enthält eine Team-ID.
- Zeiten als ISO 8601 in UTC.
- Feldnamen in snake_case. Das Frontend wandelt sie beim Empfang zentral in camelCase um.
- Fehler kommen als FastAPI-Objekt `{ "detail": "..." }`, das Frontend liest `detail` (oder `message`).
- Löschen ist weich (`deleted_at`, sofort unsichtbar). Nach 10 Tagen entfernt ein Cron-Job alles endgültig, samt `.eml` in MinIO. Der Job fehlt noch.

## Anmeldung

Die Anmeldung läuft über Keycloak, nicht über die API. Das Frontend holt sich dort ein Token und schickt es bei jedem Aufruf mit:

```http
Authorization: Bearer <access token>
```

Das Backend prüft die Signatur gegen die öffentlichen Schlüssel des Realms unter `/realms/phisheye/protocol/openid-connect/certs`, außerdem den Aussteller (`iss`) und ob `aud` den Wert `phisheye-backend` enthält. `is_operator` ist die Realm-Rolle `operator` in Keycloak. Ein Aufruf ohne gültiges Token wird mit 401 abgelehnt, ein Token mit zu schwacher Rolle mit 403. Das Frontend zeigt 403 als fehlende Berechtigung an und meldet niemanden ab.

Das Feld `sub` im Token ist die Keycloak-ID des Nutzers, nicht seine ID in unserer Datenbank. Beim ersten Aufruf muss das Backend den Nutzer anlegen und die beiden IDs verbinden.

Endpunkte unter `/auth/` entfallen damit.

## Sitzung

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/me` | Angemeldeter Nutzer, seine Teams und die aktive Rolle (umgesetzt) |
| POST | `/me/team` | Wechselt den Team-Kontext, Body `team_id` (umgesetzt) |
| PATCH | `/me` | Ändert den Anzeigenamen, Body `name` (umgesetzt) |

`GET /me` liefert `name`, `email`, `initials`, `is_operator` sowie die Teams mit `id`, `name`, `member_count` und `role`. Dazu `active_team_id`: das Team, für das der Server gerade antwortet, `null` ohne Team. Ohne dieses Feld weiß das Frontend nach einem Reload nicht, welches Team aktiv ist, und nimmt das erste der Liste.

## Analysen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/analyses` | Liste für das aktive Team (umgesetzt) |
| POST | `/analyses` | Upload einer `.eml` als Feld `file` (multipart), max. 25 MB (413 bei mehr), antwortet mit dem Listeneintrag (umgesetzt, läuft synchron im Request) |
| GET | `/analyses/{id}` | Detail (umgesetzt, `criteria` und `links` noch leer, `ai_assessment` fehlt noch) |
| DELETE | `/analyses/{id}` | Weich löschen, nur Admin (umgesetzt) |
| POST | `/analyses/{id}/decision` | Verdikt bestätigen oder als falsch-positiv melden, Body `verdict`, antwortet mit `{ verdict, by, at }` (umgesetzt) |
| DELETE | `/analyses/{id}/decision` | Entscheidung zurücknehmen (umgesetzt) |
| GET | `/analyses/{id}/eml` | Original-`.eml` aus MinIO herunterladen, geht über das Backend (MinIO ist von außen nicht erreichbar). Antwort mit `Content-Disposition: attachment` und `application/octet-stream`, die Datei kann Schadcode enthalten |
| GET | `/analyses/search?q=` | Suche über Betreff, Absender, Link-Domain und Anhang-Hash, siehe unten |
| GET | `/queue` | Wartende Jobs und Worker-Auslastung, für die Fortschrittsanzeige. Sinnvoll erst, wenn die Analyse als arq-Job läuft |

## Übersicht

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/stats?from=&to=&tz=` | Kennzahlen des aktiven Teams für die Startseite, jede Rolle |

Das Frontend schickt den Zeitraum fertig berechnet: `from` ist Mitternacht vor 6 bzw. 29 Tagen in der Zeitzone des Browsers, `to` ist jetzt, beide als ISO 8601 in UTC. `tz` ist die Zeitzone als IANA-Name (`Europe/Berlin`), nach ihr teilt das Backend die Tage für `daily` ein (`created_at AT TIME ZONE tz`). So entscheidet der Browser, wo ein Tag beginnt, und nicht die UTC-Mitternacht des Servers.

Gezählt werden abgeschlossene, nicht gelöschte Analysen des aktiven Teams mit `created_at` in `[from, to)`. Das Verdikt einer Analyse ist die Entscheidung des Analysten (`decided_verdict`), wenn es eine gibt, sonst das der Erkennung. `suspicious` kommt deshalb nur aus der Erkennung. Laufende und fehlgeschlagene Analysen zählen nicht mit.

| Feld | Typ | Bedeutung |
|---|---|---|
| counts | `{ phishing, suspicious, clean, unrated }` | Analysen im Zeitraum nach Verdikt, `unrated`: ohne Verdikt und ohne Entscheidung |
| previous | wie `counts` | derselbe Zeitraum direkt davor, `[from - (to - from), from)`, für den Trend |
| daily | Liste aus `day` und den vier Zahlen aus `counts` | ein Eintrag pro Kalendertag in `tz` von `from` bis `to`, älteste zuerst, Tage ohne Analysen mit 0. `day` als `YYYY-MM-DD` |
| open | `{ total, items }` | abgeschlossen und noch ohne Entscheidung, **unabhängig vom Zeitraum**, damit nichts Offenes herausfällt. `items`: die 5 neuesten mit `id`, `subject`, `sender`, `status`, `verdict`, `score`, `received_at` |
| decided | int | Entscheidungen an Analysen im Zeitraum |
| false_positive_rate | 0 bis 1 oder null | von den entschiedenen Analysen mit Erkennung `phishing` oder `suspicious` der Anteil, den ein Analyst als `clean` eingestuft hat. null, wenn es keine solche Entscheidung gibt |
| median_decision_minutes | Zahl oder null | Median von `decided_at - created_at` in Minuten über die entschiedenen Analysen im Zeitraum, null ohne Entscheidung |
| top_domains | Liste aus `domain`, `count` | Domain aus der Absenderadresse (klein geschrieben) der Analysen mit Verdikt `phishing`, die 5 häufigsten, häufigste zuerst |
| sources | `{ upload, report }` | Analysen im Zeitraum nach `source` |

## Team

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/team` | Mitglieder und offene Einladungen des aktiven Teams |
| POST | `/teams` | Team anlegen, Body `name`, der Nutzer wird Admin. Antwortet mit dem Team wie in `GET /me` |
| PATCH | `/team` | Umbenennen, Body `name`, nur Admin |
| DELETE | `/team` | Weich löschen, nur Admin |
| POST | `/team/invitations` | Einladen, Body `email` und `role`, antwortet mit der Einladung wie in `GET /team`. 409, wenn die Adresse schon Mitglied oder eingeladen ist |
| PATCH | `/team/invitations/{id}` | Rolle einer offenen Einladung ändern, Body `role` |
| DELETE | `/team/invitations/{id}` | Einladung zurückziehen |
| PATCH | `/team/members/{id}` | Rolle ändern, Body `role` |
| DELETE | `/team/members/{id}` | Entfernen, oder selbst verlassen |
| GET | `/team/domains` | Meldeadresse und Domains für Outlook-Meldungen |
| POST | `/team/domains` | Domain eintragen, Body `domain`, nur Admin |
| DELETE | `/team/domains/{id}` | Domain entfernen, nur Admin |

Der letzte Admin kann sich weder herabstufen noch entfernen. Das Verlassen des letzten Teams wird abgelehnt.

## Outlook-Meldungen

Mitarbeiter melden eine verdächtige Mail in Outlook, die Meldung geht an ein gemeinsames phisheye-Postfach. Das Backend holt es per POP3 ab und legt für jede Meldung eine Analyse an.

- Welches Team die Meldung bekommt, entscheidet die Domain der meldenden Adresse, nicht die des ursprünglichen Absenders.
- Kennt kein Team die Domain, geht die Meldung ans Standard-Team (`PHISHEYE_DEFAULT_TEAM_ID`, im Kern der Admin). Sie wird nicht verworfen.
- Subdomains zählen mit: `firma.de` deckt auch `mail.firma.de` ab.
- Eine Domain gehört höchstens einem Team. `POST /team/domains` antwortet mit 409, wenn ein anderes Team dieselbe Domain, eine übergeordnete oder eine Subdomain davon eingetragen hat. Die Antwort nennt das andere Team nicht.
- Ein Nachweis, dass dem Team die Domain gehört, ist nicht vorgesehen. Wer zuerst einträgt, bekommt sie.
- 422 bei ungültigen Domains, öffentlichen Mail-Anbietern wie `gmail.com` und öffentlichen Suffixen wie `co.uk` (Public Suffix List). Das Frontend zeigt die Meldung aus der Antwort an.
- Das Frontend schickt die Domain in Kleinbuchstaben, ohne `@`, `www.` und Punkt am Ende, Umlaute als Punycode. Das Backend sollte trotzdem selbst normalisieren.
- Ein Unique-Index reicht für die Subdomain-Regel nicht, die Prüfung muss in der Anwendung laufen, in derselben Transaktion wie das Eintragen.

### Benachrichtigung per Mail

Die meldende Person bekommt per Mail eine Eingangsbestätigung und das Ergebnis (Verdikt und Begründung, ohne Score). Meldende haben keinen Zugang zum Portal, die Mails enthalten deshalb keinen Link.

- Der Versand läuft als arq-Job und höchstens einmal pro Analyse (`notified_at`).
- Empfänger ist die Adresse aus `reported_by`, sie stammt aus dem `From` der weitergeleiteten Mail. Pro Adresse gehen höchstens 10 Mails pro Stunde raus.
- Auto-Antworten (`Auto-Submitted`), die eigene Absenderadresse und Systemadressen wie `mailer-daemon` bekommen nichts.
- Manuelle Uploads lösen keine Mail aus.

## Benachrichtigungen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/notifications` | Liste, ungelesene zuerst |
| POST | `/notifications/read` | Als gelesen markieren, Body `ids` oder leer für alle |

Das Backend löscht Benachrichtigungen 14 Tage nach `created_at`, gelesen oder nicht. `GET /notifications` liefert nichts Älteres.

Das Frontend fragt `GET /notifications` alle 30 Sekunden neu, solange der Tab sichtbar ist, und sofort, wenn man zurückkommt.

## Monitoring

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/monitoring` | Systemweit über alle Teams, nur für `is_operator` |
| POST | `/monitoring/jobs/{id}/retry` | Fehlgeschlagenen Job neu einreihen, nur für `is_operator` |

Liefert Warteschlange, Worker, Fehlerrate, Analysen pro Stunde, das VirusTotal-Kontingent, die Dienste-Ampel und die Fehlerliste. Die Fehlerliste enthält keine Mailinhalte. Das Frontend fragt alle 10 Sekunden neu.

Die App zeigt nur, was ein Operator jetzt wissen oder tun muss. Verlauf, Infrastruktur und Alarme (VM, Container, Postgres, Redis, MinIO, API-Latenz und 5xx, Job-Dauer, Logs) liegen in Grafana (Prometheus) und werden von dort betreut, die App verlinkt nicht dorthin. Der `/metrics`-Endpunkt für Prometheus läuft nicht über `/api`, damit er nicht öffentlich ist.

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
| handler | string oder null, null bei Meldungen, die noch niemand übernommen hat |
| source | `upload` oder `report` (Outlook-Meldung) |
| reported_by | Adresse der meldenden Person, null bei `upload` |
| received_at | timestamp |

`GET /analyses/{id}` zusätzlich:

| Feld | Typ | Beschreibung |
|---|---|---|
| thresholds | `{ suspicious, phishing }` | Schwellen kommen vom Server, das Frontend rechnet nichts nach |
| ai_assessment | `{ verdict, confidence, model }` oder null | Einschätzung von JEV zum Text der Mail, siehe [ai-assessment.md](ai-assessment.md). `verdict` ist `phishing` oder `clean`, `confidence` 0 bis 1, `model` die Version, die geantwortet hat. null, wenn JEV nicht geantwortet hat |
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
| storage_key | string oder null | interne UUID-Referenz der gespeicherten `.eml` in MinIO |

Ein Anhang besteht aus `filename`, `size` (Bytes), `sha256` (voller Hash), `virus_total` und `malicious`.

Solange `status` `running` ist, fragt das Frontend `GET /analyses/{id}` und `GET /queue` alle 3 Sekunden neu.

`GET /analyses/search?q=<text>`:

- Durchsucht nur die Analysen des aktiven Teams, ohne Groß- und Kleinschreibung.
- Das Frontend fragt erst ab 2 Zeichen und wartet 250 ms nach dem letzten Tastendruck. Eine überholte Anfrage bricht es ab.
- Gesucht wird im Betreff, in der Absenderadresse, in den Hosts der Links (Domain oder IP) und in den SHA-256-Hashes der Anhänge. Beim Hash zählt der Anfang, ab 8 Zeichen.
- Pro Analyse höchstens ein Treffer. Passt der Text auf mehrere Felder, gilt die Reihenfolge Hash, Absender, Link, Betreff.
- Höchstens 20 Treffer, neueste zuerst.

Je Treffer:

| Feld | Typ | Beschreibung |
|---|---|---|
| id, subject, sender, status, verdict, received_at | wie in `GET /analyses` | |
| field | `hash`, `sender`, `domain` oder `subject` | wo der Text gefunden wurde, danach gruppiert das Frontend |
| match | string | der gefundene Wert: voller Hash, Adresse, Host oder Betreff |

`GET /queue`:

| Feld | Typ | Beschreibung |
|---|---|---|
| waiting | number | alle wartenden Jobs, auch die anderer Teams |
| workers_busy | number | |
| workers_total | number | |
| items | Liste aus `position`, `subject`, `sender`, `source`, `submitted_by`, `queued_at` | nur Jobs des aktiven Teams, Mails anderer Teams erscheinen nur in `waiting`. Bei `report` ist `submitted_by` die Adresse der meldenden Person |

`GET /team`:

| Feld | Typ | Beschreibung |
|---|---|---|
| members | Liste aus `id`, `name`, `email`, `initials`, `role`, `two_factor_enabled`, `analysis_count`, `is_self` | `is_self` markiert den angemeldeten Nutzer |
| invitations | Liste aus `id`, `email`, `role`, `invited_at` | nur offene Einladungen |

`GET /team/domains`:

| Feld | Typ | Beschreibung |
|---|---|---|
| report_address | string | Postfach, an das Outlook die Meldungen weiterleitet, für alle Teams gleich |
| domains | Liste aus `id`, `domain`, `added_by`, `added_at` | |

`POST /team/domains` antwortet mit dem neuen Eintrag.

`GET /monitoring`:

| Feld | Typ | Beschreibung |
|---|---|---|
| queue | `{ waiting }` | |
| workers | `{ busy, total }` | |
| jobs | `{ failed, total }` | letzte 24 Stunden, daraus rechnet das Frontend die Fehlerrate |
| virus_total | `{ used, limit }` | Kontingent des Tages |
| hourly | Liste aus `hour`, `count` | 24 Einträge, älteste zuerst, `hour` ist der Beginn der Stunde |
| services | Liste aus `name`, `status` | `status` ist `ok`, `degraded` oder `down`. Latenzen gibt es nur in Grafana |
| failures | Liste aus `id`, `error`, `attempt`, `max_attempts`, `at` | fehlgeschlagene Jobs der letzten 24 Stunden, ohne Mailinhalte |

## Offen

- `GET /stats` für die Übersicht, siehe oben. Bis dahin zeigt das Frontend ohne Backend Platzhalterzahlen, mit Backend die Fehlermeldung.
- KI-Einschätzung mit JEV, Anleitung mit Beispiel-Anfrage und Python-Code in [ai-assessment.md](ai-assessment.md). Zu tun: `typesafe-sdk` als Abhängigkeit, `TYPESAFE_API_KEY` in `.env` und `.env.example` (Key nur auf dem Server), in `mail_analysis` die Spalten `ai_verdict`, `ai_confidence` und `ai_model` (nullable, mit Alembic-Migration), JEV als eigener Schritt der Analyse und `ai_assessment` in `GET /analyses/{id}`. Antwortet JEV nicht, bleibt `ai_assessment` null und die Analyse läuft trotzdem durch. Bis dahin zeigt die Detailseite „Keine KI-Einschätzung“.
- Backend-Prüfung auf 25 MB mit 413. Bisher begrenzen nur das Frontend und der nginx (30 MB).
- Cron-Job für die harte Löschung: täglich alles mit `deleted_at` älter als 10 Tage endgültig entfernen (Datenbank, Anhänge, `.eml` in MinIO).
- Analyse als arq-Job statt im Request. Erst damit sind `running`, `step` und `GET /queue` echt. Wird mit einem Spam-Testskript geprüft.
- Abbrechen einer laufenden Analyse. Die Oberfläche hat den Knopf, ein Endpunkt fehlt noch.
- Erneut starten einer fehlgeschlagenen Analyse durch Analysten. `POST /monitoring/jobs/{id}/retry` gibt es nur für Operatoren, der Knopf auf der Detailseite hat noch keinen Endpunkt.
- Einladung erneut senden. Die Oberfläche hat den Knopf, ein Endpunkt fehlt noch.
- Übernehmen einer gemeldeten Mail. Die Oberfläche zeigt `handler` null als „Niemand", ein Endpunkt zum Zuweisen fehlt.
