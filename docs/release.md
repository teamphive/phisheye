# Release und Changelog

Releases laufen über den Workflow [`release.yml`](../.github/workflows/release.yml). Er berechnet die nächste Version aus den Commits, baut die Docker-Images, schiebt sie nach ghcr.io, schreibt `CHANGELOG.md` fort, setzt den Git-Tag und legt ein GitHub-Release an. Das Changelog erzeugt [git-cliff](https://git-cliff.org) mit der Konfiguration in [`cliff.toml`](../cliff.toml).

## Release erstellen

1. GitHub → Actions → Release → Run workflow, Branch `main`.
2. Feld „Version“ leer lassen, dann berechnet git-cliff die Version. Eine eigene Version wie `1.0.0` geht auch, sie muss aber höher als die letzte sein.
3. Mit „Dry run“ werden nur die Images gebaut und die Release-Notes in der Zusammenfassung des Laufs angezeigt, gepusht wird nichts. Gut zum Testen nach Änderungen an Dockerfiles.

Ablauf im Workflow:

| Job | Macht |
| --- | --- |
| `prepare` | Version berechnen und prüfen (Format, Tag noch frei, höher als die letzte, mindestens ein Eintrag) |
| `images` | Backend-, Frontend- und Keycloak-Image bauen und pushen |
| `release` | `CHANGELOG.md` committen (`chore(release): 0.2.0`), Tag setzen, GitHub-Release mit den Notes anlegen |

Die Images kommen vor dem Tag. Scheitert ein Build, ist noch nichts getaggt und der Lauf kann nach dem Fix einfach neu gestartet werden. Hat sich `main` während des Laufs bewegt, lehnt GitHub den Push ab und es entsteht kein Tag, dann den Workflow noch einmal starten.

## Versionen

Semantic Versioning ohne `v`: `0.1.0`, `0.1.1`, `0.2.0`. Das erste Release wird `0.1.0`.

| Commits seit dem letzten Release | Nächste Version |
| --- | --- |
| mindestens ein `feat` | Minor, `0.1.3` → `0.2.0` |
| nur `fix`, `docs`, `chore` usw. | Patch, `0.1.3` → `0.1.4` |
| Breaking Change (`feat!:` oder `BREAKING CHANGE:` im Body) | Minor, solange die Version unter `1.0.0` liegt |

Ins Changelog kommen nur Commits nach [Conventional Commits](https://www.conventionalcommits.org), also `feat(frontend): ...`, `fix: ...`. Andere wie „Merge pull request“ oder „db schema“ fallen raus, `wip:` und `chore(release):` ebenso. Bei Squash-Merges zählt der PR-Titel, deshalb sollte der schon passen. Die PR-Nummer am Ende wird im Changelog verlinkt.

Vorschau auf das nächste Release lokal (braucht `uv`, siehe [setup.md](../setup.md)):

```bash
uvx git-cliff@2.14.2 --unreleased --bump
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
