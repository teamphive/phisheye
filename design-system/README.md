# phisheye

Design-System für die phisheye-Oberfläche. Ruhige, fast neutrale Flächen, das Markenblau nur als Akzent.

## Grundlagen

- **Flächen:** Kühle Graus mit leichtem Blaustich (`background`, `card`, `muted`). Im dunklen Theme neutrale Near-Black-Grautöne ohne Blaustich. Hover und aktive Zustände bleiben grau.
- **Blau:** `primary` steht für Hauptbutton, Links, Logo, Fokus und den aktiven Menüpunkt. Im hellen Theme bekommen Flächen höchstens den Schleier `accent`, im dunklen gar kein Blau.
- **Urteile:** `clean`, `suspicious`, `phishing` sind eigene Farben, getrennt vom Markenblau. Jede hat eine `-soft` Variante als Grund.
- **Karten:** 1 px Rahmen `border`, Radius `radius-lg`, im hellen Theme ein Hauch Schatten, im dunklen keiner.
- **Schrift:** Inter für alles, JetBrains Mono für Domains, Hashes und Adressen. Überschriften 600, Fließtext 400.
- **Sprache:** Deutsch, kurz, Verben auf Buttons (Neue Analyse, Speichern). Urteile heißen Phishing, Verdächtig, Legitim, Nicht bewertet.

## Logo

Haken-Öse, die zugleich ein Auge ist. Ein Farbton, flach.

- Auf Hell `brand-navy`, auf Dunkel `brand-sky`, in der Oberfläche `primary`.
- Unter 32 px die Fassung mit dickeren Linien, im Repo `assets/logo/phisheye-symbol-small.svg`.
- App-Icon: `brand-sky` auf `brand-tile`, Radius ein Viertel der Kantenlänge.
- Nicht strecken, spiegeln, umfärben oder mit Schatten versehen.

## Umsetzung

Die Tokens stehen als CSS-Variablen in `frontend/src/index.css` (Tailwind v4, shadcn mit base-ui). Komponenten kommen aus `frontend/src/components/ui/`. Neue Farben zuerst hier eintragen, dann dort.
