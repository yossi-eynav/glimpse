---

description: "Task list for automatic downloadable builds"
---

# Tasks: Automatic downloadable builds

**Input**: Design documents from `/specs/007-ci-release-builds/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R8), data-model.md,
contracts/distribution.md (D1–D5), quickstart.md

**Tests**: The workflow and scripts are build configuration, which is exempt under
Constitution I. The one behavior that matters, a valid ad-hoc signature, is test-first anyway:
`scripts/check-package.sh` is written and seen failing (T003) before the signing hook exists.
The pipeline itself is checked by the quickstart's push and PR scenarios.

**Organization**: by user story.
- **US1 (P1)**: every commit is tested and built.
- **US3 (P1)**: secrets stay secret.
- **US2 (P2)**: the single "latest" download.

US3 comes before US2 because both P1 stories must hold before anything is published.

**Outward-facing steps**: tasks that push to GitHub (T015, T019, T020) need the owner's
go-ahead, and the D3 secrets must be set first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2, US3

## Fixed values (use them exactly)

| Thing | Value |
|-------|-------|
| Workflow | `.github/workflows/build.yml`, name `Build` |
| Jobs | `test` → `package` → `release` |
| Runner | `macos-latest`, Node `24` with `cache: npm` |
| Run artifact | name `Glimpse-<version>-<sha7>`; files `Glimpse-<version>-<sha7>-universal.dmg` / `.zip`; `retention-days: 30` |
| Release | tag `latest`; title `Glimpse <version> (<sha7>)`; assets `Glimpse-universal.dmg`, `Glimpse-universal.zip` |
| Secrets | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Missing-secret message | `::error::Missing repository secret <NAME>` |
| Packaged app | `out/Glimpse-darwin-universal/Glimpse.app` |

---

## Phase 1: Setup

- [X] T001 Record the baseline: `npm test` (232 passing) and `npm run typecheck`, both clean.
  Confirm `out/Glimpse-darwin-universal/Glimpse.app` exists from the last `npm run make`.

---

## Phase 2: Foundational (blocks all stories): a signed, CI-buildable package

- [X] T002 [P] Create `scripts/check-package.sh <app>` per contract D5. It's bash with
  `set -uo pipefail`, and prints `ok …` or `FAIL …` per check. It runs every check before
  exiting, and exits 1 if any failed. The checks:
  1. `codesign --verify --deep --strict "$app"` succeeds.
  2. `codesign -dv "$app" 2>&1` contains `Signature=adhoc`.
  3. `lipo -archs "$app/Contents/MacOS/Glimpse"` contains both `arm64` and `x86_64`.
  4. `$app/Contents/Resources/` has `glimpse-helper`, `Glimpse.saver` and `google.json`.

  Make it executable.
- [X] T003 Run `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app` on today's
  package. Confirm it **fails** on check 1, with "code object is not signed at all" (quickstart
  step 1, research R1). Record the output in quickstart.md's results.
- [X] T004 [P] Create `scripts/adhoc-sign.sh <app>`. It's bash with `set -euo pipefail`. It runs
  `codesign --force --deep --sign - "$1"`, then `codesign --verify --deep --strict "$1"`, then
  echoes `Ad-hoc signed $1`. Make it executable.
- [X] T005 In `forge.config.js`, add `hooks.postPackage: async (_config, { outputPaths }) => …`.
  - It runs only when `notarize` is falsy.
  - For each output path, it runs `scripts/adhoc-sign.sh "<path>/Glimpse.app"`, using
    `execFileSync` from `node:child_process` with `stdio: 'inherit'`.

  Keep the existing `osxSign`/`osxNotarize` branch unchanged.
- [X] T006 Run `npm install-scripts approve fs-xattr macos-alias esbuild`, which writes
  `allowScripts` into `package.json` (research R2). Then:
  1. Confirm `npm install-scripts ls` lists nothing left to approve.
  2. Run `rm -rf node_modules && npm ci`.
  3. Confirm `node_modules/fs-xattr/build/Release/*.node` exists.
- [X] T007 Run `npm run make` (local `config/google.json`). Then:
  1. `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app` passes.
  2. `hdiutil attach -nobrowse -readonly out/make/dmg/universal/*.dmg`, then run
     `check-package.sh` on `/Volumes/Glimpse*/Glimpse.app`, which passes. Then `hdiutil detach`.
  3. Unzip `out/make/zip/darwin/universal/*.zip` into the scratchpad, and `check-package.sh`
     passes on that copy.

  Then run `npm test`. 232 pass.
- [ ] T008 Manual: Gatekeeper simulation (quickstart step 3). The quarantined copy in
  `/Applications` offers **Open Anyway**, not "damaged".

**Checkpoint**: local packages are validly ad-hoc signed, and a clean `npm ci` can build the dmg.

---

## Phase 3: User Story 1: Every commit is tested and built (Priority: P1) 🎯 MVP

**Goal**: FR-001 to FR-005 and FR-011. **Independent Test**: quickstart steps 5, 6 and 8.

- [X] T009 [US1] Create `.github/workflows/build.yml` with:
  - `name: Build`
  - triggers `on: push: branches: ['**']` and `pull_request:` (tags never trigger it, research
    R4)
  - workflow-level `permissions: contents: read`
  - `concurrency: { group: build-${{ github.ref }}, cancel-in-progress: true }` (R5)

  Add job `test`:
  - `runs-on: macos-latest`
  - steps:
    - `actions/checkout`
    - `actions/setup-node` (`node-version: 24`, `cache: npm`)
    - `npm ci`
    - `npm run typecheck`
    - `npm test`

  Use the current major tag of each action. Check it at implementation time, and use the newest
  major whose runtime isn't deprecated.
- [X] T010 [US1] Add job `package` to `.github/workflows/build.yml`: `needs: test`,
  `runs-on: macos-latest`. Steps:
  1. checkout, setup-node, `npm ci`
  2. **"Write Google config"**. Pass the secrets only through `env:`:
     `GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}` and `GOOGLE_CLIENT_SECRET: …`.
     - For each empty variable, print `::error::Missing repository secret <NAME>`. Exit 1 if any
       was missing (FR-009).
     - Write the file with `jq -n --arg id "$GOOGLE_CLIENT_ID" --arg secret "$GOOGLE_CLIENT_SECRET"
       '{clientId:$id, clientSecret:$secret}' > config/google.json`.
     - Never `echo` or `cat` the values or the file.
  3. **"Version"**: write `version=$(node -p "require('./package.json').version")` and
     `sha7=${GITHUB_SHA::7}` to `$GITHUB_OUTPUT` (step `id: meta`).
  4. `npm run make`. This runs the native build, plus the T005 hook.
  5. `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app`
  6. **"Collect"**: copy `out/make/dmg/universal/*.dmg` to
     `dist-ci/Glimpse-<version>-<sha7>-universal.dmg`, and `out/make/zip/darwin/universal/*.zip`
     to `dist-ci/Glimpse-<version>-<sha7>-universal.zip`. Fail if either is missing.
  7. `actions/upload-artifact` with `name: Glimpse-<version>-<sha7>`, `path: dist-ci/*`,
     `retention-days: 30` and `if-no-files-found: error`.
- [X] T011 [US1] Validate the YAML locally:
  `python3 -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/build.yml"))'`. If
  PyYAML is missing, use `ruby -ryaml -e 'YAML.load_file(".github/workflows/build.yml")'`. Run
  `actionlint` instead if it is installed. Fix any problems.

**Checkpoint**: on push, the workflow tests and builds, with the artifacts named by version and
commit.

---

## Phase 4: User Story 3: Secrets stay secret (Priority: P1)

**Goal**: FR-007 to FR-009. **Independent Test**: quickstart steps 9–11.

- [X] T012 [US3] In `.github/workflows/build.yml`, add to job `package`:
  `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`.
  Fork pull requests then run only `test` (FR-008, R4).
- [X] T013 [US3] Review `.github/workflows/build.yml`:
  - `${{ secrets.* }}` appears only under the "Write Google config" step's `env:`.
  - No step uses `set -x`.
  - The upload `path` is only `dist-ci/*`, and `release` (US2) uploads only the two renamed
    files.
  - `config/google.json` is still listed in `.gitignore`.
- [X] T014 [US3] In `README.md`, add a "Continuous builds" section, after "Package, sign and
  notarize". It covers:
  - the D2 trigger table
  - how to add the D3 secrets (Settings → Secrets and variables → Actions)
  - that fork pull requests are only tested
  - that the repository must be public for anyone to download releases (R8)

  Update "Package, sign and notarize" to say that without the Apple variables, `npm run make`
  ad-hoc signs the app.

**Checkpoint**: the secrets are only reachable where they're needed and never printed.

---

## Phase 5: User Story 2: The single "latest" download (Priority: P2)

**Goal**: FR-006 and FR-010. **Independent Test**: quickstart steps 7 and 12.

- [X] T015 [US2] Add job `release` to `.github/workflows/build.yml`:
  - `needs: package`
  - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
  - `runs-on: ubuntu-latest`. It only moves files and needs no macOS minutes.
  - `permissions: contents: write`
  - `concurrency: { group: release-latest, cancel-in-progress: false }` (R5)

  Have `package` expose `version` and `sha7` as job `outputs` from step `meta`. Steps:
  1. `actions/checkout`
  2. `actions/download-artifact` (name `Glimpse-<version>-<sha7>`, path `dl/`)
  3. Copy `dl/*-universal.dmg` to `Glimpse-universal.dmg` and `dl/*-universal.zip` to
     `Glimpse-universal.zip`.
  4. Write `notes.md` from the contract D4 template, filling in `<version>`, `<sha7>`, `<sha>`
     and the date `$(date -u +%Y-%m-%dT%H:%M:%SZ)`.
  5. `git tag -f latest "$GITHUB_SHA" && git push -f origin refs/tags/latest`
  6. With `GH_TOKEN: ${{ github.token }}`:
     - if `gh release view latest` succeeds, run `gh release edit latest --title "Glimpse
       <version> (<sha7>)" --notes-file notes.md --latest`
     - otherwise, run `gh release create latest` with the same title and notes, plus `--latest`
     - then `gh release upload latest Glimpse-universal.dmg Glimpse-universal.zip --clobber`

  Re-run T011's YAML check.
- [X] T016 [US2] In `README.md`, add an "Install" section near the top, after the feature
  bullets. It includes:
  - the D1 download links
  - the 4 D4 install steps, Open Anyway included, plus the note that on macOS 15 and later,
    right-click → Open doesn't bypass the warning
  - the Keychain "Always Allow" note after updates
  - an advanced alternative: `xattr -dr com.apple.quarantine /Applications/Glimpse.app`
  - that requirements are macOS 14 or later, on Apple silicon or Intel

**Checkpoint**: every passing main commit replaces the single latest download.

---

## Phase 6: Polish & Cross-Cutting

- [X] T017 Run `npm test` (232 pass) and `npm run typecheck`. Then run `npm run make` and
  `scripts/check-package.sh` (pass). `git status` must not show `config/google.json`.
- [X] T018 Update `specs/007-ci-release-builds/quickstart.md` with a "Recorded results" section:
  T003's failing output, T007's passing output, and T008.
- [ ] T019 Manual, after the owner adds the D3 secrets and approves the push: push to a non-main
  branch. Run quickstart steps 5, 6 and 8–11, and record the results.
- [ ] T020 Manual, after the owner approves it: merge or push to `main`, then run quickstart
  steps 7 and 12. Record the results, including the run time (SC-002 is under 20 minutes).

---

## Dependencies & Execution Order

- T001 comes first.
- **Foundational**: T002 and T004 can run in parallel. T003 needs T002 (it must fail before
  T005). T005 needs T004. T006 is independent of T002–T005. T007 needs T005 and T006, and T008
  needs T007.
- **US1** needs Foundational, because CI must build a signed package with a clean `npm ci`.
  T009 → T010 → T011 run in sequence (same file).
- **US3** needs US1 (same workflow file). T012 → T013. T014 (README) can run in parallel with
  T012 and T013.
- **US2** needs US3, so nothing publishes before the secrets are guarded. T015 needs T012, since
  it's the same file. T016 (README) runs after T014, since it's the same file.
- **Polish** comes after all of them. T019 and T020 need the owner's go-ahead to push.

## Parallel Example: Foundational

```text
T002 scripts/check-package.sh   ·   T004 scripts/adhoc-sign.sh   ·   T006 package.json allowScripts
```

## Parallel Example: User Story 3

```text
T012/T013 .github/workflows/build.yml   ·   T014 README.md "Continuous builds"
```

## Implementation Strategy

- **MVP**: Foundational plus US1 (T001–T011). Every commit is tested, and a correctly signed
  dmg and zip can be downloaded from the run.
- **Then US3**: guard the secrets before anything goes public.
- **Then US2**: the public latest release and the install docs.
- Commit after each phase. Push only when the owner says so.
