# Data Model: Automatic downloadable builds

This feature adds no application data. The "entities" are pipeline objects that GitHub stores.

## Pipeline run

One workflow run for one commit and event.

| Field | Value |
|-------|-------|
| `event` | `push` or `pull_request` |
| `ref` | branch, e.g. `refs/heads/main` |
| `sha` / `sha7` | the commit / its first 7 characters |
| `fromFork` | `true` when `pull_request.head.repo.full_name != github.repository` |
| `status` | `queued` → `in_progress` → `success`, `failure` or `cancelled` |

**State rules**:
- Any job failing makes the run `failure`. A newer push to the same `ref` makes an unfinished
  run `cancelled`.
- `package` runs only if `test` succeeded and `fromFork` is false. `release` runs only if
  `package` succeeded and `ref == refs/heads/main` and `event == push`.

## Run artifact

| Field | Rule |
|-------|------|
| name | `Glimpse-<version>-<sha7>` |
| files | `Glimpse-<version>-<sha7>-universal.dmg` and `Glimpse-<version>-<sha7>-universal.zip` |
| retention | 30 days (FR-005: at most 90) |
| contains | only those two files. Never `config/google.json` |

`<version>` comes from `package.json` `version` (currently `0.1.0`).

## Latest release

| Field | Rule |
|-------|------|
| tag | `latest`, which is force-moved to `sha` on each passing main push |
| title | `Glimpse <version> (<sha7>)` |
| notes | the template in [contracts/distribution.md](./contracts/distribution.md): version, commit link, build date (UTC, ISO 8601), install steps |
| assets | `Glimpse-universal.dmg` and `Glimpse-universal.zip`, replaced in place |
| marked latest | yes. It's the only release |

**Invariant**: the assets and the title always come from the same `sha`. Updates are serialized
(research R5).

## Repository secrets

| Name | Used by | Missing → |
|------|---------|-----------|
| `GOOGLE_CLIENT_ID` | the `package` job → `config/google.json` `clientId` | `::error::Missing repository secret GOOGLE_CLIENT_ID`, and the job fails |
| `GOOGLE_CLIENT_SECRET` | the `package` job → `config/google.json` `clientSecret` | `::error::Missing repository secret GOOGLE_CLIENT_SECRET`, and the job fails |
