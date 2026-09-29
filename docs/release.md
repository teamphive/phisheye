# Release und Changelog

Ein gepushter Versions-Tag wie `0.1.2` startet den Workflow [`release.yml`](../.github/workflows/release.yml). Er baut die Docker-Images, schiebt sie nach ghcr.io, legt ein GitHub-Release an und schreibt `CHANGELOG.md` auf `main` fort. Das Changelog erzeugt [git-cliff](https://git-cliff.org) mit der Konfiguration in [`cliff.toml`](../cliff.toml).

## Release erstellen

Auf aktuellem `main`, braucht `just` und `git-cliff` (`brew install just git-cliff`):

```bash
git switch main
git pull
just bump-version push
```

`just bump-version` berechnet mit git-cliff die nächste Version, setzt den Tag auf `HEAD` und pusht ihn mit `push`. Ohne `push` bleibt der Tag lokal zum Prüfen, gepusht wird er dann mit `git push origin 0.2.0`. Eine eigene Version geht auch von Hand: `git tag -a 1.0.0 -m 1.0.0` und `git push origin 1.0.0`.

Soll über den Notes ein Hinweis stehen, etwa zu einer neuen Variable in der `.env` (wie bei [zjstatus 0.25.0](https://github.com/dj95/zjstatus/releases/tag/v0.25.0)), kommt er in die Tag-Nachricht. `just bump-version` schreibt dort nur die Version hinein, die zeigt git-cliff nicht an. Mit Hinweis den Tag von Hand setzen und danach wie oben pushen, jedes `-m` wird ein Absatz:

```bash
git tag -a "$(git cliff --bumped-version)" -m "⚠️ Braucht KEYCLOAK_PUBLIC_URL in der .env."
```

Ablauf im Workflow:

| Job | Macht |
| --- | --- |
| `prepare` | Tag prüfen (Format `0.1.2`, Commit liegt auf `main`, neueste Version) und Release-Notes in der Zusammenfassung des Laufs zeigen |
| `images` | Backend-, Frontend- und Keycloak-Image bauen und pushen |
| `release` | GitHub-Release mit den Notes anlegen, dann `CHANGELOG.md` als `chore(release): 0.2.0` auf `main` committen |

Der Tag bleibt, wo er gesetzt wurde. Der Changelog-Commit kommt danach auf `main`, der getaggte Stand enthält also noch das Changelog des vorigen Releases, das GitHub-Release hat die vollständigen Notes. Das Changelog wird aus dem Tag erzeugt, Commits, die nach dem Tag auf `main` gelandet sind, zählen zum nächsten Release.

Wenn etwas schiefgeht:

- Build kaputt: Der Tag existiert schon, es gibt aber weder Images noch Release. Tag löschen (`git push --delete origin 0.2.0` und `git tag -d 0.2.0`), Fix auf `main` bringen, neu taggen.
- `main` hat sich während des Laufs bewegt: Der Push des Changelogs wird abgelehnt. Im Lauf „Re-run failed jobs“ klicken, Release und Changelog werden dabei nicht doppelt angelegt.
- Tag auf einem Commit außerhalb von `main`: `prepare` bricht ab, Tag löschen und auf `main` neu setzen.

## Versionen

Semantic Versioning ohne `v`: `0.1.0`, `0.1.1`, `0.2.0`. `just bump-version` rechnet so:

| Commits seit dem letzten Release | Nächste Version |
| --- | --- |
| mindestens ein `feat` | Minor, `0.1.3` → `0.2.0` |
| nur `fix`, `docs`, `chore` usw. | Patch, `0.1.3` → `0.1.4` |
| Breaking Change (`feat!:` oder `BREAKING CHANGE:` im Body) | Minor, solange die Version unter `1.0.0` liegt |

Ins Changelog kommen nur Commits nach [Conventional Commits](https://www.conventionalcommits.org), also `feat(frontend): ...`, `fix: ...`. Andere wie „Merge pull request“ oder „db schema“ fallen raus, `wip:`, `chore(release):` und `chore(deps):` ebenso. Bei Squash-Merges zählt der PR-Titel, deshalb sollte der schon passen. Die PR-Nummer am Ende wird im Changelog verlinkt.

Das Layout ist von [zjstatus](https://github.com/dj95/zjstatus/blob/main/cliff.toml) übernommen: Der Scope steht kursiv vor dem Eintrag (`*(frontend)* Show …`), Breaking Changes bekommen `[**breaking**]`, die Abschnitte haben Emojis und eine feste Reihenfolge:

| Abschnitt | Commit-Typen |
| --- | --- |
| 🚀 Features | `feat` |
| 🐛 Bug Fixes | `fix` |
| 🚜 Refactor | `refactor`, `ref` |
| 📚 Documentation | `docs` |
| ⚡ Performance | `perf` |
| 🎨 Styling | `style` |
| 🧪 Testing | `test` |
| ⚙️ Miscellaneous Tasks | `chore`, `ci`, `build` |
| ◀️ Revert | `revert` |
| 💼 Other | alle übrigen Typen |

Vorschau auf das nächste Release lokal:

```bash
git cliff --unreleased --bump
```

## Images

| Image | Gebaut aus |
| --- | --- |
| `ghcr.io/teamphive/phisheye-backend` | `backend/Dockerfile` |
| `ghcr.io/teamphive/phisheye-frontend` | `frontend/Dockerfile`, letzte Stage (nginx) |
| `ghcr.io/teamphive/phisheye-keycloak` | `frontend/Dockerfile`, Stage `keycloak` (Keycloak mit Login-Theme) |

Jedes Image bekommt die Tags `0.2.0`, `0.2`, `latest` und `sha-<commit>`, nur für `linux/amd64`.

Das Frontend liest die Keycloak-Adresse beim Build. Der Workflow nimmt dafür die Repository-Variable `KEYCLOAK_PUBLIC_URL` (Settings → Secrets and variables → Actions → Variables), ohne sie `https://phisheye.neumann-it.org`. Ändert sich die Domain, braucht es ein neues Release.

## Einmalig einrichten

- Die Pakete sind privat wie das Repo. Auf der VM einmal mit einem Personal Access Token (classic, Scope `read:packages`) anmelden: `docker login ghcr.io -u <github-user>`.
- Nach dem ersten Release tauchen die Pakete unter github.com/orgs/teamphive/packages auf und sind mit dem Repo verknüpft.
- Der Workflow pusht mit dem `GITHUB_TOKEN` direkt auf `main`. Bekommt `main` später eine Branch-Protection oder ein Ruleset mit Pflicht-PR, braucht GitHub Actions dort eine Ausnahme, sonst scheitert der Job `release`.

## Rollback

Jede Version bleibt als eigener Image-Tag in der Registry. Für einen Rollback zeigt der Server auf eine ältere Version, zum Beispiel wenn die Services in der Compose-Datei so eingetragen sind:

```yaml
backend:
  image: ghcr.io/teamphive/phisheye-backend:${PHISHEYE_VERSION:-latest}
```

```bash
PHISHEYE_VERSION=0.1.1 docker compose --profile app pull
PHISHEYE_VERSION=0.1.1 docker compose --profile app up -d
```

Datenbank-Migrationen gehen dabei nicht mit zurück. Hat das neuere Release eine Alembic-Migration mitgebracht, muss die vorher mit `alembic downgrade` zurückgedreht werden, sonst passt das alte Backend nicht zum Schema.
