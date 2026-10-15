# Outlook-Add-in

Ein Knopf "Melden" im Menüband von Outlook. Er öffnet eine neue Mail an das Meldepostfach, die geöffnete Mail hängt als Anlage dran. Die Person klickt nur noch auf Senden.

Die Dateien liegen in `frontend/public/outlook-addin/` und kommen mit dem Frontend auf den Server. Das Add-in braucht keinen eigenen Dienst und keine Anmeldung.

## Installieren

Nach dem Deploy erreichbar unter `https://phisheye.neumann-it.org/outlook-addin/manifest.xml`.

- **Für sich selbst:** In Outlook "Add-Ins abrufen", "Meine Add-Ins", "Benutzerdefiniertes Add-In hinzufügen", "Aus Datei" (Menünamen je nach Version). Manifest vorher herunterladen.
- **Für alle:** Ein Microsoft-365-Admin stellt das Manifest zentral bereit (Admin Center, "Integrierte Apps", "Benutzerdefinierte Apps hochladen").

Der Knopf erscheint beim Lesen einer Mail, im Menüband unter "phisheye".

## Anpassen

- **Meldeadresse:** `REPORT_ADDRESS` in `commands.js`.
- **Domain:** alle URLs in `manifest.xml`. Neue `Id` vergeben, wenn ein zweites Add-in daneben laufen soll.
- **Version:** `Version` in `manifest.xml` erhöhen, sonst übernimmt Outlook die Änderung nicht.

## Grenzen

- Die Meldung kommt als Anlage, je nach Outlook-Version als `.msg` oder `.eml`. Beides liest phisheye.
- Das Team der Meldung folgt der Domain der meldenden Person (siehe [Teams](infrastructure.md)).
- Das Manifest ist mit `office-addin-manifest validate` geprüft. Der Ablauf in einem echten Outlook läuft noch nicht: Der Test mit einem Outlook.com-Konto im Web (über einen Tunnel) hat keinen Knopf gezeigt, die Ursache ist offen.

## Offen

- Fehler suchen: Browser-Konsole, Aufruf von `commands.html`, `Office.onReady` und `Office.actions.associate` im Netzwerk-Tab prüfen.
- Alternativ ein Gerüst von `yo office` (Outlook, Befehle) daneben legen und vergleichen.
- Neues Manifest-Format (JSON, "unified manifest") prüfen, falls das XML-Format im Zielkonto nicht mehr greift.
