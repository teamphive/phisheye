# Logo

Das Zeichen ist eine Angelhaken-Öse, die zugleich ein Auge ist: Phishing (Haken) und Überwachung (Auge) in einer Form.

## Dateien

| Ordner | Inhalt |
| --- | --- |
| `symbol/` | Zeichen allein: schwarz, weiß, hellblau, navy, quadratisch, App-Icon, Web-Icons (`favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `maskable-512.png`, `site.webmanifest`) |
| `horizontal/` | Zeichen links, Schriftzug rechts |
| `stacked/` | Zeichen über dem Schriftzug |
| `wordmark/` | nur der Schriftzug |

Die Master liegen direkt in diesem Ordner: `phisheye-symbol.svg`, `phisheye-symbol-small.svg`, `phisheye-horizontal.svg`, `phisheye-stacked.svg`, `phisheye-wordmark.svg`. Der Schriftzug ist Inter SemiBold als Pfad, ohne Live-Text.

## Farben

| Name | Hex | Einsatz |
| --- | --- | --- |
| Hellblau | `#7da3f5` | Zeichen auf dunklem Grund |
| Navy | `#1a1f3a` | Zeichen auf hellem Grund |
| Kachel | `#16203A` | Hintergrund des App-Icons |

Immer nur eine Farbe. Keine Verläufe, keine Schatten, keine Kontur.

## Regeln

- Unter 32 px das Zeichen `phisheye-symbol-small.svg` nehmen. Es hat dickere Linien, damit Ring und Pupille offen bleiben.
- Mindestgröße: Zeichen 16 px, horizontales Logo 96 px Breite.
- Freiraum: mindestens die Breite der Pupille (ein Siebtel der Zeichenhöhe) rundum.
- Nicht strecken, drehen, spiegeln oder umfärben. Nicht auf unruhige Bilder legen.

## Im Frontend

`frontend/public/` enthält die Web-Icons, `frontend/src/components/brand-mark.tsx` das Zeichen als Komponente (`currentColor`). Neu erzeugen: Master ändern und `export_variants.py` aus dem logo-design-Skill laufen lassen.

## Offen

Keine Markenrecherche gemacht. Vor einer echten Veröffentlichung eine Bildersuche und Markenrecherche machen.
