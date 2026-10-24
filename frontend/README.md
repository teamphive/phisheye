# phisheye frontend

React + TypeScript + Vite Frontend für phisheye.

## Voraussetzungen

Node 22, dieselbe Version wie in der CI (siehe `setup.md` im Root).

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

## Prüfen

```bash
npm run lint
npm run typecheck
npm test
```

Dieselben Schritte und der Build laufen in der CI, siehe [ci-cd.md](../docs/ci-cd.md). `npm run format` formatiert mit Prettier.

## Aufbau

| Ordner oder Datei | Inhalt |
| --- | --- |
| `src/pages` | eine Datei pro Seite, die Routen stehen in `src/routes.tsx` |
| `src/layouts` | Rahmen mit Sidebar und Kopfleiste, Rahmen für Seiten ohne Login |
| `src/components` | eigene Komponenten, in `ui/` die von shadcn |
| `src/lib` | API-Client, Keycloak, Rechte, Formatierung, die Tests liegen daneben |
| `src/mocks` | Beispieldaten für den Betrieb ohne Backend |
| `src/keycloak-theme` | Login-Seiten für Keycloak, siehe unten |
| `email-theme` | Mails, die Keycloak verschickt |
| `public` | Favicons, Web-Manifest, Logos für die Mails |
| `Dockerfile` | App mit nginx, dazu die Stage `keycloak` (Keycloak mit Login-Theme) |
| `nginx.conf` | liefert die App aus, reicht `/api` ans Backend und `/auth` an Keycloak weiter |

## Keycloak-Theme

Die Login-Seiten, die Keycloak ausliefert, kommen aus diesem Projekt: Keycloakify baut aus `src/keycloak-theme` ein Login-Theme im phisheye-Design. `src/main.tsx` entscheidet beim Start, ob die App oder das Theme läuft; innerhalb von Keycloak liegt `window.kcContext` vor.

Eigene Seiten, alle unter `src/keycloak-theme/login/pages`:

| Seite | Datei |
| --- | --- |
| Login, 2FA-Abfrage, Anmeldemethode wählen | `login.ftl`, `login-otp.ftl`, `select-authenticator.ftl` |
| Passwort vergessen, neues Passwort | `login-reset-password.ftl`, `login-update-password.ftl` |
| 2FA einrichten, Backup-Codes sichern und eingeben | `login-config-totp.ftl`, `login-recovery-authn-code-config.ftl`, `login-recovery-authn-code-input.ftl` |
| Konto einrichten nach einer Einladung: Schritte und Abschluss, Profil | `info.ftl`, `login-update-profile.ftl` |
| E-Mail-Adresse bestätigen | `login-verify-email.ftl` |
| Authenticator-Gerät entfernen, aus den Einstellungen | `delete-credential.ftl` |
| Fehler, abgelaufene Seite, Abmelden bestätigen | `error.ftl`, `login-page-expired.ftl`, `logout-confirm.ftl` |

Alle anderen Seiten zeigt Keycloakify im Standard-Look von Keycloak, sie kommen bei phisheye nicht vor. `npm install` kopiert sie per `postinstall` nach `src/keycloak-theme/login` und hält sie aus Git heraus. Eine davon anpassen:

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

Alle Seiten der App sind ans Backend angebunden, Aufrufe laufen über `src/lib/api.ts`. Ohne `VITE_API_URL` kommen die Inhalte aus `src/mocks`, ohne Keycloak-Variablen läuft die App ohne Anmeldung. Welche Endpunkte das Backend noch nicht hat, steht in [api.md](../docs/api.md) unter „Offen“.
