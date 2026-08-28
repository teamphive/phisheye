# Prüfkriterien für Phishing-Erkennung

Sammlung aller Signale, mit denen eine Mail bewertet werden kann.
Die Liste ist als Roadmap gedacht, nicht als Pflichtumfang für die
erste Version.

## Legende

- `[D]` deterministisch, direkt in Code prüfbar
- `[KI]` Einschätzung durch das Sprachmodell
- Gesetzte Checkbox bedeutet: implementiert
- `(v1)` für die erste Ausbaustufe eingeplant, siehe unten

## Header

- [ ] From und Reply-To weichen voneinander ab `[D]` **(v1)**
- [ ] Return-Path passt nicht zum From-Header `[D]` **(v1)**
- [ ] Display-Name nennt eine Marke, Adresse passt nicht dazu `[D]`
- [ ] `Re:` oder `AW:` ohne `In-Reply-To` und `References` `[D]`
- [ ] Message-ID-Domain passt nicht zur Absenderdomain `[D]`
- [ ] Received-Kette mit unplausiblen geografischen Sprüngen `[D]`
- [ ] Gefälschte Received-Header am Ende der Kette `[D]`
- [ ] X-Mailer deutet auf Massenversand oder PHPMailer `[D]`
- [ ] Empfänger steht weder in To noch in Cc `[D]`
- [ ] Date-Header liegt in der Zukunft `[D]`
- [ ] Content-Language passt nicht zur Sprache des Textes `[D]`

## Authentifizierung

- [ ] SPF-Ergebnis ist fail oder softfail `[D]` **(v1)**
- [ ] DKIM-Signatur fehlt oder ist ungültig `[D]` **(v1)**
- [ ] DMARC-Ergebnis ist fail `[D]` **(v1)**
- [ ] DMARC-Policy steht auf none statt quarantine oder reject `[D]`
- [ ] SPF-Record endet auf `+all` `[D]`

## Absenderdomain und Infrastruktur

- [ ] Domain jünger als 30 Tage, geprüft über RDAP `[D]`
- [ ] Kein MX-Record für die Absenderdomain vorhanden `[D]`
- [ ] TLD mit schlechter Reputation, etwa zip, top oder click `[D]`
- [ ] Punycode oder IDN-Homoglyphen im Domainnamen `[D]`
- [ ] Geringe Levenshtein-Distanz zu einer bekannten Marke `[D]`
- [ ] Sender-IP steht auf einer Blocklist `[D]`
- [ ] rDNS der Sender-IP passt nicht zur Absenderdomain `[D]`
- [ ] TLS-Zertifikat der Zieldomain erst kürzlich ausgestellt `[D]`

## Links

- [ ] Anzeigetext des Links weicht vom tatsächlichen Ziel ab `[D]` **(v1)**
- [ ] Empfängeradresse ist in der Ziel-URL enthalten `[D]`
- [ ] Auffällig viele Subdomains im Hostnamen `[D]`
- [ ] IP-Adresse statt Domainname `[D]` **(v1)**
- [ ] Userinfo-Trick mit `@` in der URL `[D]`
- [ ] Open-Redirect-Parameter wie `url=` oder `redirect=` `[D]`
- [ ] URL-Shortener im Einsatz `[D]`
- [ ] Zwischenstation bei einem legitimen Cloud-Dienst `[D]`
- [ ] Genau ein Call-to-Action-Link in der gesamten Mail `[D]`

## Anhänge

- [ ] Hash bei VirusTotal als schädlich bekannt `[D]` **(v1, externe Abfrage)**
- [ ] Echter Dateityp passt nicht zur Dateiendung `[D]` **(v1)**
- [ ] HTML-Anhang mit obfuskiertem JavaScript `[D]`
- [ ] Passwortgeschütztes Archiv, Passwort steht im Mailtext `[D]`
- [ ] Doppelte Dateiendung wie rechnung.pdf.exe `[D]` **(v1)**
- [ ] RTL-Override im Dateinamen, Unicode U+202E `[D]`
- [ ] Containerformat wie iso, img, lnk oder OneNote `[D]`
- [ ] SVG mit eingebettetem Script `[D]`
- [ ] Makros in einer Office-Datei `[D]`
- [ ] QR-Code in einem Bildanhang, sogenanntes Quishing `[D]`

## Inhalt und Darstellung

- [ ] Mail besteht nahezu vollständig aus einem Bild `[D]`
- [ ] Unsichtbarer Text zur Umgehung von Filtern `[D]`
- [ ] Zeitdruck, Drohung oder gesetzte Frist `[KI]`
- [ ] Unpersönliche Anrede trotz behaupteter Kundenbeziehung `[KI]`
- [ ] Auffällige Sprachqualität oder maschinelle Übersetzung `[KI]`
- [ ] Aufforderung zu Zugangsdaten, Zahlung oder Gutscheinkauf `[KI]`
- [ ] CEO-Fraud-Muster aus Eile und Vertraulichkeit `[KI]`
- [ ] Markenimitation in Layout, Logo und Farbgebung `[KI]`

## Ergebnis der Linkverfolgung

- [ ] Login-Formular auf der Zielseite erkannt `[KI]`
- [ ] Zielseite imitiert eine bekannte Marke `[KI]`
- [ ] Kette endet an einem Bot-Gate oder CAPTCHA `[D]`
- [ ] Mehrere Weiterleitungen bis zur eigentlichen Zielseite `[D]`

## Erste Ausbaustufe (v1)

Stand 28.08.2026. Für die erste Version sind bewusst nur vier Prüfungen vorgesehen. Sie decken die vier Stellen ab, an denen eine Phishing-Mail auffällt: Absenderidentität, Header, Link und Anhang. Alles Weitere in diesem Dokument bleibt Roadmap und ist oben mit `(v1)` von der ersten Ausbaustufe abgegrenzt.

Priorität ist, dass die Anwendung als Ganzes funktioniert. Die Anzahl der umgesetzten Kriterien fließt nicht in die Bewertung ein.

| # | Prüfung | Kriterien aus der Liste | Gewicht |
|---|---------|-------------------------|---------|
| 1 | Authentifizierung fehlgeschlagen | SPF, DKIM, DMARC | 40 |
| 2 | Link-Anzeigetext weicht vom Ziel ab | Anzeigetext ungleich Ziel, IP statt Domain | 30 |
| 3 | Anhang-Typ passt nicht zur Endung | Magic Bytes ungleich Endung, doppelte Endung | 30 |
| 4 | From weicht von Reply-To oder Return-Path ab | Reply-To, Return-Path | 20 |

Die gewichtete Summe wird bei 100 gekappt. Vorläufige Schwellen: 0 bis 39 sauber, 40 bis 74 verdächtig, 75 bis 100 Phishing. Ein einzelnes Signal ergibt damit noch kein Phishing-Verdikt, zwei Signale landen im Bereich verdächtig, drei ergeben Phishing. Die Schwellen werden nach dem ersten Testdurchlauf mit echten Mails nachjustiert und kommen aus der API, nicht aus dem Frontend.

### Umsetzungshinweise

- Die Authentifizierung wird **nicht selbst nachgerechnet**. DKIM zu verifizieren bedeutet Canonicalization und RSA-Prüfung, SPF bedeutet DNS-Include-Ketten und Makros. Der empfangende Mailserver hat das bereits erledigt und schreibt das Ergebnis in den Header `Authentication-Results`. Geparst wird nur diese Zeile. Fehlt der Header, gilt das Kriterium als nicht bewertbar und ausdrücklich nicht als bestanden.
- Der From-Vergleich läuft auf **Domain-Ebene**, nicht auf der vollen Adresse. Newsletter und Ticketsysteme haben legitim ein abweichendes Reply-To.
- Anhänge werden über **Magic Bytes** geprüft, zusätzlich wird auf doppelte Endungen geachtet.
- Der **VirusTotal-Hash-Abgleich** bleibt bestehen, zählt aber als externe Abfrage und nicht als deterministisches Kriterium. Er deckt in `features.md` das Wahlpflicht-Feature "Anbindung an externe APIs" ab.

### Testmaterial

Vor der Umsetzung exportiert jedes Teammitglied fünf bis zehn echte Phishing-Mails sowie einige harmlose Mails als `.eml`. Dieser Satz dient gleichzeitig als Datengrundlage für die Tests der Kernfunktionen und zeigt, ob die Gewichte sinnvoll gewählt sind.

### Nächster Kandidat

Domain-Alter über RDAP, falls am Ende Zeit bleibt. Homoglyphen und Levenshtein-Distanz zu bekannten Marken brauchen eine gepflegte Markenliste und bleiben vorerst außen vor.

## Umsetzung des Scorings

Kein einzelnes Kriterium entscheidet allein über das Ergebnis. Jede
Prüfung liefert ein Objekt mit Name, Auslösung, Gewicht und
Begründung. Die gewichtete Summe ergibt den Risiko-Score.

Das Sprachmodell bewertet nicht von null, sondern bekommt die
deterministischen Ergebnisse zusammen mit dem Mailtext. Es ordnet
ein, formuliert den Bericht und erkennt inhaltliche Muster. Der
Score selbst bleibt im Code, damit er testbar und erklärbar ist.

## Bewusst nicht vorgesehen

Kontextsignale aus dem Postfach eines Unternehmens werden nicht
ausgewertet. Eine Anbindung an eine Firmendatenbank ist nicht Teil
des Projekts. Damit entfallen unter anderem:

- Prüfung, ob bereits früher Kontakt zu diesem Absender bestand
- Abgleich mit dem bisherigen Mailverkehr der Organisation
- Erkennung von Abweichungen gegenüber üblichem Kommunikationsverhalten
