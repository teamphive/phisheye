# Prüfkriterien für Phishing-Erkennung

Sammlung aller Signale, mit denen eine Mail bewertet werden kann.
Die Liste ist als Roadmap gedacht, nicht als Pflichtumfang für die
erste Version.

## Legende

- `[D]` deterministisch, direkt in Code prüfbar
- `[KI]` Einschätzung durch das Sprachmodell
- Gesetzte Checkbox bedeutet: implementiert

## Header

- [ ] From und Reply-To weichen voneinander ab `[D]`
- [ ] Return-Path passt nicht zum From-Header `[D]`
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

- [ ] SPF-Ergebnis ist fail oder softfail `[D]`
- [ ] DKIM-Signatur fehlt oder ist ungültig `[D]`
- [ ] DMARC-Ergebnis ist fail `[D]`
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

- [ ] Anzeigetext des Links weicht vom tatsächlichen Ziel ab `[D]`
- [ ] Empfängeradresse ist in der Ziel-URL enthalten `[D]`
- [ ] Auffällig viele Subdomains im Hostnamen `[D]`
- [ ] IP-Adresse statt Domainname `[D]`
- [ ] Userinfo-Trick mit `@` in der URL `[D]`
- [ ] Open-Redirect-Parameter wie `url=` oder `redirect=` `[D]`
- [ ] URL-Shortener im Einsatz `[D]`
- [ ] Zwischenstation bei einem legitimen Cloud-Dienst `[D]`
- [ ] Genau ein Call-to-Action-Link in der gesamten Mail `[D]`

## Anhänge

- [ ] Hash bei VirusTotal als schädlich bekannt `[D]`
- [ ] Echter Dateityp passt nicht zur Dateiendung `[D]`
- [ ] HTML-Anhang mit obfuskiertem JavaScript `[D]`
- [ ] Passwortgeschütztes Archiv, Passwort steht im Mailtext `[D]`
- [ ] Doppelte Dateiendung wie rechnung.pdf.exe `[D]`
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

## Empfehlung für die erste Ausbaustufe

Nicht alle Kriterien auf einmal umsetzen. Diese Auswahl deckt einen
Großteil der realen Fälle ab und ist in überschaubarer Zeit machbar:

- From und Reply-To weichen ab
- Return-Path passt nicht zum From-Header
- Display-Name-Spoofing
- SPF, DKIM und DMARC auswerten
- Domain-Alter über RDAP
- Anzeigetext des Links weicht vom Ziel ab
- Punycode und Homoglyphen
- Echter Dateityp passt nicht zur Endung
- HTML-Anhang mit obfuskiertem JavaScript
- Hash-Abgleich über VirusTotal

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
