# phisheye frontend

React + TypeScript + Vite Frontend für phisheye.

## Voraussetzungen

Node muss installiert sein (siehe `docs/setup.md`).

## Installieren

```bash
npm install
```

## Konfigurieren

```bash
cp .env.example .env
```

Darin stehen die Adresse von Keycloak und die des Backends. Ohne diese Datei startet die App ohne Anmeldung, damit sich die Oberfläche auch ohne laufendes Keycloak ansehen lässt. Mit der Datei verlangt jeder Seitenaufruf ein Token, Keycloak muss also erreichbar sein (`docker compose up -d keycloak` im Wurzelverzeichnis).

## Ausführen (Dev-Server)

```bash
npm run dev
```

Läuft dann unter `http://localhost:5173`.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Keycloak-Theme

Die Login-Seiten, die Keycloak ausliefert, kommen aus diesem Projekt: Keycloakify baut aus `src/keycloak-theme` ein Login-Theme im phisheye-Design. `src/main.tsx` entscheidet beim Start, ob die App oder das Theme läuft; innerhalb von Keycloak liegt `window.kcContext` vor.

Eigene Seiten gibt es bisher für Login (`login.ftl`), 2FA-Abfrage (`login-otp.ftl`), Passwort vergessen (`login-reset-password.ftl`), neues Passwort (`login-update-password.ftl`), 2FA einrichten (`login-config-totp.ftl`), Backup-Codes sichern (`login-recovery-authn-code-config.ftl`) und eingeben (`login-recovery-authn-code-input.ftl`) sowie die Auswahl der Anmeldemethode (`select-authenticator.ftl`), alle unter `src/keycloak-theme/login/pages`. Alle anderen Seiten zeigt Keycloakify vorerst im Standard-Look von Keycloak. `npm install` kopiert sie per `postinstall` nach `src/keycloak-theme/login` und hält sie aus Git heraus. Eine davon anpassen:

```bash
npx keycloakify own --path login/pages/<seite>/Page.tsx
```

Ohne Keycloak mit Beispieldaten ansehen. Die Leiste am unteren Rand wechselt zwischen den Seiten und schaltet einen Fehlversuch an:

```bash
npm run dev-keycloak-theme
```

Die `.jar` für Keycloak landet in `dist_keycloak/phisheye-keycloak-theme.jar`. Dafür muss Maven installiert sein (`brew install maven`):

```bash
npm run build-keycloak-theme
```

In Docker ist das nicht nötig: Der `keycloak`-Service baut sein Image aus der Stage `keycloak` im `Dockerfile` und packt das Theme dabei selbst. Nach Änderungen am Theme:

```bash
docker compose up -d --build keycloak
```

## Stand

Grundgerüst via Vite aufgesetzt, shadcn/ui eingerichtet (`components.json`).
Anmeldung über Keycloak angebunden, Aufrufe ans Backend laufen über `src/lib/api.ts`.
Die Seiteninhalte kommen noch aus `src/mocks`.
