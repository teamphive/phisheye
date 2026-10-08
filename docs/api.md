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

Das Backend prüft die Signatur gegen die öffentlichen Schlüssel des Realms unter `/realms/phisheye/protocol/openid-connect/certs`, außerdem den Aussteller (`iss`) und ob `aud` den Wert `phisheye-backend` enthält. `is_operator` kommt aus der Realm-Rolle `operator` in Keycloak oder daraus, dass der Nutzer Instanz-Admin ist (siehe Sitzung). Ein Aufruf ohne gültiges Token wird mit 401 abgelehnt, ein Token mit zu schwacher Rolle mit 403. Das Frontend zeigt 403 als fehlende Berechtigung an und meldet niemanden ab.

Das Feld `sub` im Token ist die Keycloak-ID des Nutzers, nicht seine ID in unserer Datenbank. Beim ersten Aufruf muss das Backend den Nutzer anlegen und die beiden IDs verbinden.

Endpunkte unter `/auth/` entfallen damit.

## Sitzung

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/me` | Angemeldeter Nutzer, seine Teams und die aktive Rolle (umgesetzt) |
| POST | `/me/team` | Wechselt den Team-Kontext, Body `team_id`. Instanz-Mitglieder dürfen jedes Team wählen, alle anderen nur eigene, sonst 404 (umgesetzt) |
| PATCH | `/me` | Ändert den Anzeigenamen, Body `name` (umgesetzt) |

`GET /me` liefert `name`, `email`, `initials`, `is_operator`, `instance_role` (`admin`, `audit` oder `null`), `can_create_teams` sowie die Teams mit `id`, `name`, `member_count`, `role` und `via_instance`. Dazu `active_team_id`: das Team, für das der Server gerade antwortet, `null` ohne Team. Ohne dieses Feld weiß das Frontend nach einem Reload nicht, welches Team aktiv ist, und nimmt das erste der Liste.

Instanz-Rollen: Das **Standard-Team** ist das Instanz-Team. Dort gibt es nur die Rollen `admin` und `audit`. Wer dort Mitglied ist, darf in jedes Team wechseln:

- Der **Instanz-Admin** hat in fremden Teams die Rolle `admin` und ist automatisch Operator. Nur er erstellt Teams.
- Der **Instanz-Auditor** hat in fremden Teams die Rolle `audit` und liest nur.
- `via_instance` ist `true` bei Teams, in denen der Nutzer nicht selbst Mitglied ist, und `role` ist dann seine Instanz-Rolle. `can_create_teams` ist nur für den Instanz-Admin wahr.
- Das Standard-Team hat einen festen Namen. Es lässt sich nicht umbenennen oder löschen (409), und Einladungen, Rollenwechsel dort mit `analyst` werden mit 422 abgelehnt.
- Betritt ein Instanz-Mitglied ein fremdes Team, schreibt das Backend eine Logzeile.
- Der erste Instanz-Admin kommt über `PHISHEYE_ADMIN_EMAIL` (siehe [infrastructure.md](infrastructure.md)).

## Analysen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/analyses` | Liste für das aktive Team (umgesetzt) |
| POST | `/analyses` | Upload einer `.eml` oder `.msg` als Feld `file` (multipart), antwortet mit dem Listeneintrag (umgesetzt, die Analyse läuft danach als arq-Job). Eine `.msg` wandelt das Backend vor dem Speichern in eine `.eml` um, gespeichert wird die umgewandelte Mail. Das Backend lehnt ab: andere Endungen (422), Dateien ohne Mail-Header oder mit Binär-Signatur (422), eine kaputte `.msg` (422), mehr als 25 MB (413) |
| GET | `/analyses/{id}` | Detail (umgesetzt) |
| DELETE | `/analyses/{id}` | Weich löschen, nur Admin (umgesetzt) |
| POST | `/analyses/{id}/decision` | Verdikt bestätigen oder als falsch-positiv melden, Body `verdict`, antwortet mit `{ verdict, by, at }` (umgesetzt). Bei einer Outlook-Meldung geht zwei Minuten später die Mail an die meldende Person, siehe unten. Nur wer die Analyse zugewiesen hat, darf entscheiden: niemand zugewiesen 409, jemand anderes zugewiesen 403 |
| DELETE | `/analyses/{id}/decision` | Entscheidung zurücknehmen (umgesetzt), die Zuweisung bleibt. Gleiche Regel wie beim Entscheiden: nur die zugewiesene Person (409 und 403). Ein noch wartender Mail-Job tut danach nichts |
| POST | `/analyses/{id}/assignment` | Analyse übernehmen, antwortet mit `{ handler }` (umgesetzt, siehe Zuweisung) |
| DELETE | `/analyses/{id}/assignment` | Analyse abgeben, antwortet mit 204 (umgesetzt, siehe Zuweisung) |
| GET | `/analyses/{id}/eml` | Original-`.eml` aus MinIO herunterladen, geht über das Backend (MinIO ist von außen nicht erreichbar). Antwort mit `Content-Disposition: attachment` und `application/octet-stream`, die Datei kann Schadcode enthalten |
| GET | `/analyses/search?q=` | Suche über Betreff, Absender, Link-Domain und Anhang-Hash, siehe unten (umgesetzt, ohne Link-Hosts) |
| GET | `/queue` | Wartende Jobs und Worker-Auslastung, für die Fortschrittsanzeige (umgesetzt) |

### Zuweisung

Eine Analyse ist höchstens einer Person zugewiesen. Die Detailseite zeigt sie in der Karte „Fall“ unter „Zugewiesen“ mit „Übernehmen“ oder „Abgeben“. Nach einer Entscheidung kommt dort „Bearbeitet von“ dazu, das ist `decision.by` und braucht kein eigenes Feld.

Datenmodell:

- Neue Spalte `handled_by` in `mail_analyses`, nullable, Fremdschlüssel auf `users.id`, mit Alembic-Migration.
- In Liste und Detail wird daraus `handler`: der `name` dieser Person, genau wie in `GET /me`, sonst null. Das Frontend vergleicht `handler` mit dem eigenen `name`, um „Abgeben“ statt „Übernehmen“ zu zeigen. Den festen Wert `"handler": None` in `_list_item` ersetzen. `_list_item` bekommt bisher nur die Analyse, für den Namen braucht die Liste einen Join auf `users` (nicht pro Zeile nachschlagen), das Detail kann ihn wie `_decision` per `db.get` holen.
- Beim Upload (`POST /analyses`) ist `handled_by` die hochladende Person. Nur die Upload-Route gibt `handled_by` an `submit_analysis`, alle anderen Wege starten ohne Zuweisung.
- Bei Outlook-Meldungen bleibt `handled_by` null. Dort ist `submitted_by` der System-Nutzer, der darf nie zugewiesen sein.
- Die Migration füllt bestehende Analysen: Uploads (`reported_by` null) bekommen `submitted_by`, danach bekommen entschiedene Analysen ohne Zuweisung `decided_by`. Alle anderen bleiben null. Meldungen über den Mailgun-Webhook haben ebenfalls kein `reported_by`, deshalb schließt die Migration den System-Nutzer über seine Adresse aus.

`POST /analyses/{id}/assignment`, ohne Body:

- Nur Admin und Analyst, Audit bekommt 403 wie bei der Entscheidung (`require_role(membership, "admin", "analyst")`).
- Analyse eines anderen Teams oder gelöscht: 404, wie überall über `_team_analysis`.
- Setzt `handled_by` auf die anfragende Person, auch wenn schon jemand anderes zugewiesen ist. Die Oberfläche fragt in dem Fall vorher nach, das Backend nicht.
- Schon entschieden (`decided_verdict` gesetzt): 409. Erst die Entscheidung zurücknehmen, die Oberfläche zeigt dann keinen Knopf.
- Ist man schon selbst zugewiesen, einfach noch einmal 200.
- Antwort 200 mit `{ "handler": "<name>" }`.

`DELETE /analyses/{id}/assignment`:

- Rollen und 404 wie bei `POST`.
- Nur die zugewiesene Person darf abgeben. Wer jemand anderem eine Analyse abnehmen will, nimmt `POST`. Ist eine andere Person zugewiesen: 403.
- Schon entschieden: 409, wie bei `POST`.
- Setzt `handled_by` auf null, Antwort 204. Ist niemand zugewiesen, ebenfalls 204.

Zusammenspiel mit der Entscheidung:

- Entscheiden und Zurücknehmen darf nur, wem die Analyse zugewiesen ist. Wer nicht zugewiesen ist, übernimmt sie zuerst. Niemand zugewiesen: 409 "Take the analysis on first". Jemand anderes zugewiesen: 403 "Only the assigned person can decide".
- `POST /analyses/{id}/decision` weist nicht mehr zu. Die Antwort bleibt `{ verdict, by, at }`.
- `DELETE /analyses/{id}/decision` lässt `handled_by` unverändert.
- Übernehmen (`POST …/assignment`) dürfen Admin und Analyst, der Auditor nicht (403). Es geht auch bei einer schon entschiedenen Analyse, damit sie nie bei einer abwesenden Person hängen bleibt. Danach darf die neue Person die Entscheidung zurücknehmen oder ändern.
- Abgeben (`DELETE …/assignment`) geht weiter nur bei unentschiedenen Analysen und nur für die zugewiesene Person.

Tests, die das abdecken: übernehmen, fremde Analyse übernehmen, abgeben, fremde Analyse abgeben (403), Audit (403), anderes Team (404), entschiedene Analyse übernehmen (200) und abgeben (409), Entscheiden ohne Zuweisung (409), Entscheiden und Zurücknehmen durch Fremde (403), Upload startet mit der hochladenden Person, Meldung startet mit null.

## Übersicht

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/stats?from=&to=&tz=` | Kennzahlen des aktiven Teams für die Startseite, jede Rolle (umgesetzt) |

Das Frontend schickt den Zeitraum fertig berechnet: `from` ist Mitternacht vor 6 bzw. 29 Tagen in der Zeitzone des Browsers, `to` ist jetzt, beide als ISO 8601 in UTC. `tz` ist die Zeitzone als IANA-Name (`Europe/Berlin`), nach ihr teilt das Backend die Tage für `daily` ein (`created_at AT TIME ZONE tz`). So entscheidet der Browser, wo ein Tag beginnt, und nicht die UTC-Mitternacht des Servers.

Das Backend rechnet in Python, nicht in SQL: Die Analysen des Zeitraums werden geladen und mit `zoneinfo` in Tage geteilt. Ein Team hat dort wenige hundert Analysen, und so rechnen Postgres und SQLite in den Tests gleich (SQLite kennt weder `AT TIME ZONE` noch einen Median). 422 bei unbekannter Zeitzone, `from` nicht vor `to` oder mehr als 366 Tagen.

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
| GET | `/team` | Mitglieder und offene Einladungen des aktiven Teams (umgesetzt) |
| POST | `/teams` | Team anlegen, Body `name`, nur Instanz-Admin, der Nutzer wird Admin. Antwortet mit dem Team wie in `GET /me` (umgesetzt) |
| PATCH | `/team` | Umbenennen, Body `name`, nur Admin (umgesetzt) |
| DELETE | `/team` | Weich löschen, nur Admin (umgesetzt) |
| POST | `/team/invitations` | Einladen, Body `email` und `role`, antwortet mit der Einladung wie in `GET /team`. 409, wenn die Adresse schon Mitglied oder eingeladen ist (umgesetzt, nur Admin) |
| PATCH | `/team/invitations/{id}` | Rolle einer offenen Einladung ändern, Body `role` (umgesetzt, nur Admin) |
| DELETE | `/team/invitations/{id}` | Einladung zurückziehen (umgesetzt, nur Admin) |
| PATCH | `/team/members/{id}` | Rolle ändern, Body `role`, nur Admin (umgesetzt) |
| DELETE | `/team/members/{id}` | Entfernen (nur Admin), oder selbst verlassen (umgesetzt) |
| GET | `/team/domains` | Meldeadresse und Domains für Outlook-Meldungen (umgesetzt) |
| POST | `/team/domains` | Domain eintragen, Body `domain`, nur Admin (umgesetzt) |
| DELETE | `/team/domains/{id}` | Domain entfernen, nur Admin (umgesetzt) |

Einladungen:

- Jede Person bekommt zuerst unsere Einladungsmail mit dem Teamnamen.
- Hat sie noch kein Konto oder kein Passwort, legt der Worker es in Keycloak an (Service-Account `phisheye-backend-admin`) und Keycloak schickt eine zweite Mail. Darüber setzt die Person Passwort und Profil. Der Link gilt sieben Tage. Ein Passwort kennt das Backend nie.
- Wer schon ein Konto hat, bekommt nur unsere Mail, mit dem Link zur App.
- Bei der nächsten Anfrage mit passender, von Keycloak bestätigter E-Mail wird die Person Mitglied, die Einladung verschwindet. Das gilt auch für bestehende Konten. Eine Adresse, die jemand selbst ändern kann, zählt erst nach der Bestätigung, sonst könnte man sich in fremde Einladungen eintragen. Legt ein Admin ein Konto von Hand an, muss er in Keycloak "Email verified" setzen.
- Neue Konten starten ohne Team.
- Gelöschte Teams und bestehende Mitgliedschaften werden übersprungen.

Der letzte Admin kann sich weder herabstufen noch entfernen. Das Verlassen des letzten Teams wird abgelehnt. Beides antwortet mit 409. Die `id` eines Mitglieds ist die Nutzer-ID.

## Outlook-Meldungen

Mitarbeiter melden eine verdächtige Mail in Outlook, die Meldung geht an ein gemeinsames phisheye-Postfach. Das Backend holt es per POP3 ab und legt für jede Meldung eine Analyse an.

- Die gemeldete Mail darf als `.eml` (`message/rfc822`) oder als `.msg`-Anhang kommen.
- Was keine Mail ist, bekommt keine Analyse. Der Abruf verwirft es mit einer Warnung im Log und löscht es aus dem Postfach, sonst käme es bei jedem Lauf wieder.

- Welches Team die Meldung bekommt, entscheidet die Domain der meldenden Adresse, nicht die des ursprünglichen Absenders.
- Kennt kein Team die Domain, geht die Meldung ans Standard-Team. Sie wird nicht verworfen.
- Subdomains zählen mit: `firma.de` deckt auch `mail.firma.de` ab.
- Eine Domain gehört höchstens einem Team. `POST /team/domains` antwortet mit 409, wenn ein anderes Team dieselbe Domain, eine übergeordnete oder eine Subdomain davon eingetragen hat. Die Antwort nennt das andere Team nicht.
- Ein Nachweis, dass dem Team die Domain gehört, ist nicht vorgesehen. Wer zuerst einträgt, bekommt sie.
- 422 bei ungültigen Domains, öffentlichen Mail-Anbietern wie `gmail.com` und öffentlichen Suffixen wie `co.uk` (Public Suffix List). Das Frontend zeigt die Meldung aus der Antwort an.
- Das Frontend schickt die Domain in Kleinbuchstaben, ohne `@`, `www.` und Punkt am Ende, Umlaute als Punycode. Das Backend normalisiert trotzdem selbst.
- Ein Unique-Index reicht für die Subdomain-Regel nicht. Die Prüfung läuft in der Anwendung, in derselben Transaktion wie das Eintragen. Der Index fängt nur die gleiche Domain ab.
- `report_address` ist das Postfach aus `POP3_USERNAME`. Passt die Domain eines Teams auf die meldende Adresse, geht die Meldung dorthin. Gelöschte Teams bekommen keine Meldungen mehr.

### Benachrichtigung per Mail

Die meldende Person erfährt das Ergebnis erst, wenn ein Analyst entschieden hat. Es geht nie eine automatische Bewertung raus, auch nicht bei Phishing. Die Mail nennt die Entscheidung (Phishing oder unbedenklich), bei Phishing dazu die Gründe der Regeln, ohne Score. Meldende haben keinen Zugang zum Portal, die Mail enthält deshalb keinen Link.

- `POST /analyses/{id}/decision` reiht den Job `send_decision_mail` mit zwei Minuten Verzögerung ein (`DECISION_MAIL_DELAY_SECONDS`, 120). In der Zeit lässt sich die Entscheidung zurücknehmen oder ändern.
- Der Job liest den Zustand beim Ausführen. Zurückgenommen oder schon gemeldet: nichts. Geändert nach dem Versand: Korrektur-Mail ("Neubewertung"). Hat der Analyst in der Pause erneut geklickt, wartet der Job auf den neuen.
- `notified_verdict` merkt, was die Person zuletzt gehört hat. `notified_at` zählt für die Stundenbegrenzung.
- Scheitert die Analyse nach allen Versuchen, bekommt die Person direkt eine kurze Mail, dass sie die Mail später noch einmal melden soll (`send_failure_mail`). Eine Eingangsbestätigung gibt es nicht.
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
| handler | string oder null. Name der zugewiesenen Person, genau wie `name` in `GET /me`, daran erkennt das Frontend die eigenen. Beim Upload die hochladende Person, bei Meldungen null, bis jemand übernimmt |
| decision | `{ verdict, by, at }` oder null, wie im Detail (offen, das Backend liefert das Feld in der Liste noch nicht). Die Liste zeigt damit das Verdikt des Analysten statt der Erkennung, die Spalte „Status“ (bestätigt oder nicht) und den Filter „Nicht bestätigt“. Ohne das Feld steht überall „Nicht bestätigt“ |
| source | `upload` oder `report` (Outlook-Meldung) |
| reported_by | Adresse der meldenden Person, null bei `upload` |
| received_at | timestamp |

`GET /analyses/{id}` zusätzlich:

| Feld | Typ | Beschreibung |
|---|---|---|
| thresholds | `{ suspicious, phishing }` | Schwellen kommen vom Server, das Frontend rechnet nichts nach |
| ai_assessment | `{ verdict, confidence, model }` oder null | Einschätzung von JEV zum Text der Mail, siehe [ai-assessment.md](ai-assessment.md). `verdict` ist `phishing` oder `clean`, `confidence` 0 bis 1, `model` die Version, die geantwortet hat. null, wenn JEV nicht geantwortet hat |
| criteria | Liste aus `name`, `finding`, `weight` | alle vier Prüfungen aus [detection-criteria.md](detection-criteria.md), nicht ausgelöste mit `weight` 0 |
| criteria_total | number | Summe der Gewichte vor dem Kappen, bis 120. `score` ist dieselbe Summe, bei 100 gekappt |
| links | Liste aus `text`, `target`, `finding`, `tone` | alle http- und https-Links der Mail, höchstens 100. `tone` ist `phishing`, wenn der Anzeigetext eine andere Domain zeigt, `suspicious` bei einer IP statt Domain, sonst `clean` |
| attachments | Liste, siehe unten | |
| raw_headers | text | |
| decision | `{ verdict, by, at }` oder null | |
| duration_seconds | number oder null | zeigt das Frontend nicht mehr an, kann weg |
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
| members | Liste aus `id`, `name`, `email`, `initials`, `role`, `two_factor_enabled`, `analysis_count`, `is_self` | `is_self` markiert den angemeldeten Nutzer. `two_factor_enabled` kommt aus Keycloak (Zugangsdaten vom Typ `otp`), `false` heißt nicht eingerichtet, ohne Konto ebenfalls `false`. Antwortet Keycloak nicht, ist der Wert `null` (unbekannt). |
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

- Cron-Job für die harte Löschung: täglich alles mit `deleted_at` älter als 10 Tage endgültig entfernen (Datenbank, Anhänge, `.eml` in MinIO).
- Spam-Testskript, das viele Mails auf einmal hochlädt und prüft, ob Warteschlange und Worker mithalten.
- Abbrechen einer laufenden Analyse. Ein Endpunkt fehlt, bis dahin zeigt die Detailseite keinen Knopf dafür.
- Erneut starten einer fehlgeschlagenen Analyse durch Analysten. `POST /monitoring/jobs/{id}/retry` ist nur für Operatoren. Bis es einen Endpunkt für Analysten gibt, zeigt die Detailseite keinen Knopf und schickt Operatoren ins Monitoring.
