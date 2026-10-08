# KI-Einschätzung mit JEV

Neben den Regeln bewertet [JEV](https://docs.typesafe.ai/introduction) von TypeSafe den Text jeder Mail. JEV ist kein Chat-Modell, das Text schreibt: Es beantwortet vorher festgelegte Fragen mit festen Antworten und liefert dazu Wahrscheinlichkeiten und eine Konfidenz. Für phisheye reicht eine Frage mit zwei Antworten, Phishing oder kein Phishing. Die Einschätzung steht auf der Detailseite als eigene Karte unter dem Score der Regeln und ändert weder Score noch Verdikt.

## Anfrage

Ein Endpunkt für alles, Authentifizierung mit dem API-Key als Bearer-Token:

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <TYPESAFE_API_KEY>
Content-Type: application/json
```

| Feld | Inhalt |
| --- | --- |
| `model` | `jev-1.13.0`, die Version fest statt `jev-latest`. Der Alias zieht bei einem neuen Release ohne Vorwarnung um, und die Schwellen für die Konfidenz gelten für eine bestimmte Version |
| `state` | Was bewertet wird: Absender, Betreff und Text der Mail als Objekt |
| `questions` | Die Fragen mit frei gewählten Namen. Die Antworten kommen unter denselben Namen zurück |

Die Frage ist eine `choice` mit zwei Optionen. Eine `noul` wäre die einfachere Ja/Nein-Frage, liefert aber nur einen Wert zwischen 0 und 1 und keine Konfidenz. Die Frage steht auf Englisch, weil JEV auf Englisch trainiert ist und dort am genauesten antwortet:

```json
{
  "model": "jev-1.13.0",
  "state": {
    "from": "DHL Rechnungsservice <buchhaltung@dhl-versand-tracking.top>",
    "reply_to": "billing-desk@mail-reply-service.top",
    "subject": "Ihre Rechnung RE-2024-88431 ist überfällig",
    "body": "Sehr geehrter Kunde, ..."
  },
  "questions": {
    "phishing": {
      "type": "choice",
      "instructions": "Is this email a phishing attempt?",
      "criteria": {
        "phishing": "Tries to trick the recipient into giving away credentials, payment data or money, or into opening a link or attachment, for example with a spoofed sender, urgency or threats",
        "legitimate": "An ordinary email that asks for nothing unusual, including newsletters, invoices and notifications from real senders"
      }
    }
  }
}
```

## Antwort

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "phishing": {
      "type": "choice",
      "choice": "phishing",
      "confidence": 0.94,
      "probabilities": { "phishing": 0.97, "legitimate": 0.03 }
    }
  },
  "usage": { "input_tokens": 412, "output_tokens": 30 }
}
```

Daraus wird `ai_assessment` in `GET /analyses/{id}`: `choice` `phishing` wird `verdict` `phishing`, `legitimate` wird `clean`. `confidence` und `model` gehen unverändert durch.

`confidence` ist nicht die Wahrscheinlichkeit für Phishing, sondern wie eindeutig sich JEV entschieden hat: 1 heißt, die ganze Wahrscheinlichkeit liegt auf einer Antwort, 0 heißt 50 zu 50. Nach der [Doku zur Konfidenz](https://docs.typesafe.ai/confidence) ist eine Antwort unter 0,5 unsicher. Die Detailseite zeigt unter 0,5 „gering“ mit Warnhinweis, ab 0,8 „hoch“. Die Werte sind ein Startpunkt und sollten an echten Mails überprüft werden.

## Worauf achten

- Nur in den `state`, was die Frage braucht. Ein großer State mit Nebensächlichem macht JEV ungenauer, und für `state` plus die längste Frage gibt es 32.000 Tokens. Den Text der Mail ohne HTML schicken und kürzen, etwa auf 20.000 Zeichen. Header, Links und Anhänge prüfen schon die Regeln.
- Phishing-Mails sind Angriffe. Text in der Mail, der JEV gezielt umstimmen soll, kann die Antwort verschieben, das steht so in der [Liste bekannter Schwächen](https://docs.typesafe.ai/model-jaggedness/jev-1.13). Deshalb bleibt JEV eine zweite Meinung und fließt nicht in Score und Verdikt ein.
- Deutsche Mails beantwortet JEV, aber weniger genau als englische. Vor dem Einsatz mit echten deutschen Mails testen.
- Fehler: `401` falscher Key, `422` fehlerhafte Anfrage, `429` Rate-Limit, `529` überlastet. Das SDK wiederholt `429` und `529` selbst mit Backoff. Scheitert die Anfrage endgültig, ist `ai_assessment` null und die Analyse läuft trotzdem durch.
- Kosten: 0,042 US-Dollar pro Million Eingabe-Tokens, Ausgabe kostenlos. Eine Mail hat grob einige hundert bis wenige tausend Tokens. Limit 40 Anfragen pro Sekunde.
- Datenschutz: Der Inhalt jeder Mail geht an TypeSafe. Laut TypeSafe wird damit nicht trainiert, Zero Data Retention gibt es nur für Enterprise-Kunden, siehe [Legal](https://docs.typesafe.ai/legal).

## Umsetzung im Backend

Umgesetzt in `backend/app/services/ai_assessment.py`, im arq-Job als Schritt „KI-Einschätzung wird eingeholt“ nach Regeln und VirusTotal. Abweichend vom Vorschlag unten:

- Ohne `TYPESAFE_API_KEY` geht keine Anfrage raus, `ai_assessment` bleibt null.
- Als `body` geht der Klartext-Teil der Mail, nur ohne ihn der HTML-Teil ohne Tags, Skripte und Styles. Leerräume werden zusammengefasst, danach wird auf 20.000 Zeichen gekürzt.
- Eine Anfrage hat 20 Sekunden. Jeder Fehler des SDK (falscher Key, Rate-Limit, Überlastung, keine Verbindung) gibt null, die Analyse läuft weiter. Geloggt wird nur der Fehlertyp, kein Mailinhalt.
- Die Tests schicken nie echte Anfragen: `tests/conftest.py` entfernt den Key für jeden Test, die SDK-Tests laufen gegen einen nachgebauten Server.

Der ursprüngliche Vorschlag:


- SDK: `uv add typesafe-sdk` (Python ab 3.10). Im arq-Worker `AsyncTypeSafeClient` als eigener Schritt neben Regeln und VirusTotal.
- Key: `TYPESAFE_API_KEY` in der `.env` auf dem Server, das SDK liest die Variable selbst. Nie ins Frontend, `VITE_`-Variablen landen im ausgelieferten JavaScript.
- Speichern: in `mail_analysis` die Spalten `ai_verdict`, `ai_confidence` und `ai_model`, alle nullable.

```python
from typesafe_sdk import AsyncTypeSafeClient, Choice

PHISHING_QUESTION = {
    "phishing": Choice(
        instructions="Is this email a phishing attempt?",
        criteria={
            "phishing": "Tries to trick the recipient into giving away credentials, payment data or money, or into opening a link or attachment, for example with a spoofed sender, urgency or threats",
            "legitimate": "An ordinary email that asks for nothing unusual, including newsletters, invoices and notifications from real senders",
        },
    ),
}


async def assess(mail: dict) -> dict:
    async with AsyncTypeSafeClient(model="jev-1.13.0") as client:
        response = await client.system_one(mail, PHISHING_QUESTION)

    answer = response.choices["phishing"]
    return {
        "verdict": "phishing" if answer.choice == "phishing" else "clean",
        "confidence": answer.confidence,
        "model": response.model,
    }
```

Die Frage lässt sich im [Playground](https://console.typesafe.ai/playground) mit echten Mails ausprobieren, bevor sie in den Code geht.
