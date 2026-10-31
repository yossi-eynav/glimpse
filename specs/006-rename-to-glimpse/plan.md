# Implementation Plan: Rename the app to Glimpse

**Branch**: `006-rename-to-glimpse` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-rename-to-glimpse/spec.md`

## Summary

This plan replaces the old product name everywhere in the repository's live files. The old name
appears as "Google Photos Wallpaper" and as the internal forms `PhotoWallpaper`,
`photowallpaper` and `pw-helper`, in 25 files outside `specs/`.

The single source for every new name is the rename map in [data-model.md](./data-model.md),
covering:

- display names
- bundle identifiers
- the data folder
- the helper binary
- the screensaver bundle and its class
- the handoff folder shared with the screensaver

The changes are mechanical. Three things need care:

- **The handoff folder** is hard-coded on both sides, in TypeScript and in Swift. Both change
  in the same commit.
- **The screensaver's Objective-C class** gets a new name. An old bundle left installed then
  can't clash with the new one inside the screensaver host process (research R3).
- **There is no migration.** Per the clarification, Glimpse starts fresh. Leftovers are
  removed by hand and aren't documented (owner's decision).

## Technical Context

**Language/Version**: unchanged. TypeScript 7 on Node 24.22 and Electron 45, plus Swift for
the two native pieces.

**Primary Dependencies**: none new.

**Storage**: the data folder becomes `~/Library/Application Support/Glimpse/`. Electron derives
it from `productName`. The old folder isn't read or touched.

**Testing**:
- `node:test` (232 tests today).
- The screensaver installer, uninstall and handoff tests assert the new paths first, so they
  go red before the code changes.
- A repo-wide grep check, which is quickstart step 1.

**Target Platform**: macOS 14 or later, unchanged.

**Project Type**: desktop app (Electron, plus Swift helpers).

**Performance Goals**: N/A.

**Constraints**:
- The app and the screensaver must agree on the handoff folder name.
- Text that names Google's own service stays (FR-002).
- The historical feature records `specs/001`–`specs/005` aren't edited.

**Scale/Scope**:
- About 25 files edited.
- 1 file renamed, the saver Swift source.
- Old-name matches in live files go from 70 or more to 0.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.1) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change | ✅ The path changes in `src/core/screensaver/` (installer, uninstall, handoff) are behavior. Their tests are updated to the new names first and seen failing. The display strings in `src/main/` and the build and config renames are build or configuration changes, which are exempt; quickstart steps 1–4 check them |
| II. Simplicity | No speculative work | ✅ No migration code (per the clarification) and no new abstraction. The display name isn't pulled into a shared constant: four call sites don't justify it |
| Desktop: credentials | Protected by the OS secure store | ✅ Unchanged. The Keychain item becomes "Glimpse Safe Storage", which is why the user signs in again (R2) |
| Desktop: lifecycle and others | — | ✅ Not affected |

**Pre-design gate**: PASS. **Post-design re-check**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-rename-to-glimpse/
├── spec.md
├── plan.md
├── research.md              # R1–R5
├── data-model.md            # the rename map (old → new), the single source of names
├── contracts/names.md       # names other components rely on (handoff folder, saver class, helper path)
├── quickstart.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
package.json, forge.config.js           # name, productName, appBundleId, extraResource paths
scripts/build-native.sh                 # output names: glimpse-helper, Glimpse.saver
native/helper/main.swift                # comments and log prefix
native/saver/Info.plist                 # executable, identifier, display name, principal class
native/saver/PhotoWallpaperSaverView.swift → native/saver/GlimpseSaverView.swift
src/core/screensaver/{handoff,installer,uninstall}.ts   # paths
src/core/wallpaper/{desktop,helper-protocol}.ts         # comments
src/main/main.ts, tray.ts, platform/loopback-server.ts  # display strings, resource paths
src/main/platform/helper-desktop.ts     # log and error text
tests/core/screensaver/*.test.ts, tests/main/helper-desktop.test.ts,
tests/core/rotation/{engine,external-change}.test.ts, tests/support/fake-helper.mjs
README.md, PRIVACY.md                   # names, paths
.specify/memory/constitution.md         # drop the leftover Sync Impact Report comment
```

**Structure Decision**: no structural change. The same files are edited in place, and one
file is renamed.

## Complexity Tracking

No constitution violations.
