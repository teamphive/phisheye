# Prüfkriterien

Vier deterministische Prüfungen. Jede liefert Name, Auslösung, Gewicht und Begründung, die gewichtete Summe ergibt den Risiko-Score.

| # | Prüfung | Grundlage | Gewicht |
|---|---------|-----------|---------|
| 1 | Authentifizierung fehlgeschlagen | Header `Authentication-Results`: spf, dkim, dmarc | 40 |
| 2 | Anzeigetext weicht vom Linkziel ab | Text im `<a>` gegen href, dazu IP statt Domainname | 30 |
| 3 | Anhang-Typ passt nicht zur Endung | Magic Bytes, doppelte Endung | 30 |
| 4 | From weicht von Reply-To oder Return-Path ab | Vergleich auf Domain-Ebene | 20 |

Die Summe wird bei 100 gekappt. Schwellen: 0 bis 39 sauber, 40 bis 74 verdächtig, 75 bis 100 Phishing. Die Schwellen liefert die API, das Frontend rechnet nichts nach.

Zusätzlich läuft ein VirusTotal-Abgleich der Anhang-Hashes. Er zählt als externe Abfrage, nicht als deterministisches Kriterium.

## Umsetzung

- Die Authentifizierung wird nicht selbst nachgerechnet. Der empfangende Mailserver schreibt das Ergebnis in `Authentication-Results`, geparst wird nur diese Zeile. Fehlt der Header, gilt das Kriterium als nicht bewertbar und nicht als bestanden.
- Der From-Vergleich läuft auf Domain-Ebene, nicht auf der vollen Adresse. Newsletter und Ticketsysteme haben legitim ein abweichendes Reply-To.
- Anhänge werden über Magic Bytes geprüft, zusätzlich auf doppelte Endungen.
- Gezählt wird nur der oberste `Authentication-Results`-Header. Ihn schreibt der Server, der die Mail zuletzt angenommen hat, tiefere kann der Absender selbst fälschen. `fail` und `softfail` lösen aus.
- Die Links kommen aus dem HTML-Teil, ohne HTML aus den Adressen im Text. Ein Anzeigetext löst nur aus, wenn er selbst wie eine Domain aussieht (`www.paypal.com`), „Rechnung ansehen“ nicht. Subdomains der gezeigten Domain sind in Ordnung.
- Domains werden über die Public Suffix List auf die registrierbare Domain gekürzt: `srv14.dhl.de` und `dhl.de` gelten als gleich, `dhl.de.evil.top` nicht.
- Umgesetzt in `backend/app/services/detection.py`, als Schritt „Kriterien werden geprüft“ im arq-Job.
- Die Gewichte sind vorläufig. Bei vier Prüfungen mit einer Summe von 120 erreicht fast jede echte Phishing-Mail den Höchstwert, der Score unterscheidet dann nicht mehr zwischen eindeutig und grenzwertig. Nachjustieren, sobald Testmails vorliegen.

## Testmaterial

Jedes Teammitglied exportiert fünf bis zehn echte Phishing-Mails und einige harmlose als `.eml`. Das ist zugleich die Datengrundlage für die Tests der Kernfunktionen.
