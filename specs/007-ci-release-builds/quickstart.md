# Quickstart & Validation: Automatic downloadable builds

## Local checks (before pushing)

1. **The signature test fails first** (Constitution I). On today's package, run
   `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app`. It exits non-zero, and
   the signature check reports "code object is not signed at all".
2. **Signed package**. After the `postPackage` hook is added, `npm run make` signs the app.
   - `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app` passes every check.
   - Mount `out/make/dmg/universal/*.dmg`, then run `check-package.sh` on the `Glimpse.app`
     inside it. That passes too, which shows the makers packed the signed app.
3. **Gatekeeper simulation**:
   1. Copy the app to `/Applications`.
   2. Run `xattr -w com.apple.quarantine "0083;$(printf %x $(date +%s));Safari;" /Applications/Glimpse.app`.
   3. Open it.

   macOS offers Done or Move to Trash, not "damaged". **Open Anyway** then appears in
   Privacy & Security, and after approving, Glimpse starts.
4. Run `npm install-scripts ls`. It reports nothing left to approve for `fs-xattr`,
   `macos-alias` and `esbuild`.

## Pipeline checks (after pushing)

The owner first adds the [D3 secrets](./contracts/distribution.md#d3-secrets-owner).

| # | Action | Expected |
|---|--------|----------|
| 5 | Push a commit to a branch other than `main` | A run starts within a minute. `test` and `package` pass, and the run offers the artifact `Glimpse-0.1.0-<sha7>` with the dmg and zip. The `latest` release is unchanged. Total under 20 minutes (SC-002) |
| 6 | Push a commit that breaks a test | `test` fails, `package` and `release` are skipped, and there is no artifact |
| 7 | Push or merge to `main` | `release` runs. The releases page shows "Glimpse 0.1.0 (<sha7>)" with both assets and the D4 notes. The D1 links download those files |
| 8 | Push twice quickly to the same branch | The first run is cancelled. Only the second finishes |
| 9 | Temporarily rename the `GOOGLE_CLIENT_ID` secret and push | `package` fails with "Missing repository secret GOOGLE_CLIENT_ID" |
| 10 | Open a pull request from a fork, or check the logic with a test fork | `test` runs, `package` is skipped, and nothing is published |
| 11 | Search a full run log for the client ID and secret | 0 matches (they're masked as `***`) (SC-004) |
| 12 | On another Mac (ideally one Intel, one Apple silicon), follow the README Install steps from the releases page | Glimpse is in the menu bar in under 5 minutes (SC-003), and signing in works |

## Recorded results

- **2026-10-31, T003 (red)**: `scripts/check-package.sh` on the package built before this
  feature:

  ```text
  FAIL signature is valid (codesign --verify --deep --strict)
       out/Glimpse-darwin-universal/Glimpse.app: code object is not signed at all
  ok   signature is ad-hoc
  ok   universal (arm64 + x86_64)
  ok   bundles Resources/glimpse-helper
  ok   bundles Resources/Glimpse.saver
  ok   bundles Resources/google.json
  ```

  The exit code was 1.
- **2026-10-31, T006**: after `rm -rf node_modules && npm ci`, `npm install-scripts ls` reports
  "No packages with unreviewed install scripts". `fs-xattr` and `macos-alias` built their
  `.node` files.
- **2026-10-31, T007 (green)**: `npm run make` printed "Ad-hoc signed …/Glimpse.app" in the
  `postPackage` hook. `check-package.sh` passed all 6 checks on:
  - the packaged app
  - the app inside the mounted DMG
  - the app unzipped from the zip

  `npm test` passed 232 of 232. The first `make` after the clean `npm ci` failed once with
  `TypeError: fetch failed`, a transient Electron download error. The retry passed.
- **2026-10-31, T008 (partial)**: on a quarantined copy, `spctl --assess --type execute` reports
  `rejected`, which means not notarized, as expected. It doesn't give a broken-seal ("damaged")
  reason. Seeing **Open Anyway** on screen is still a manual check.
- **2026-10-31, workflow logic**: the "Write Google config" and "Prepare assets and notes" step
  scripts were run locally with `/bin/bash` 3.2, the same as macOS runners:
  - With both secrets missing, it prints both `::error::Missing repository secret …` lines and
    exits 1. With one missing, it names that one.
  - With both set, it writes `{clientId, clientSecret}`.
  - The release notes render with the version, commit link and UTC date.
- **Action versions**: the latest major tags on 2026-10-31 were `actions/checkout@v7`,
  `actions/setup-node@v7`, `actions/upload-artifact@v7` and `actions/download-artifact@v8`
  (checked with `git ls-remote`).
