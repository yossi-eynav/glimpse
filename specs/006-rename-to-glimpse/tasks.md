---

description: "Task list for renaming the app to Glimpse"
---

# Tasks: Rename the app to Glimpse

**Input**: Design documents from `/specs/006-rename-to-glimpse/`

**Prerequisites**: plan.md, spec.md, research.md (R1 inventory, R2–R5), data-model.md (rename map
N1–N12), contracts/names.md (C1–C5), quickstart.md

**Tests**: The path changes in `src/core/screensaver/` are behavior changes, so they are
test-first (Constitution Principle I). Their tests switch to the new names and are seen failing
before the code changes. Display strings, build and config renames are build or configuration
changes, which are exempt, and quickstart steps 1–4 check them.

**Organization**: by user story.
- **US1 (P1)**: names users see.
- **US2 (P2)**: one name across the repository.
- **US3 (P3)**: the owner's old setup (start fresh, plus manual clean-up).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2, US3

## Rename map (data-model.md; use these values exactly)

| # | Old | New |
|---|-----|-----|
| N1 | Google Photos Wallpaper | Glimpse |
| N2 | google-photos-wallpaper | glimpse |
| N3 | com.example.photowallpaper | com.yossieynav.glimpse |
| N6 | pw-helper | glimpse-helper |
| N7 | PhotoWallpaperSaver.saver | Glimpse.saver |
| N8 | PhotoWallpaperSaver (executable, `-module-name`) | Glimpse |
| N9 | `CFBundleName` Google Photos Wallpaper | Glimpse |
| N10 | com.example.photowallpaper.saver | com.yossieynav.glimpse.saver |
| N11 | PhotoWallpaperSaverView | GlimpseSaverView |
| N12 | `…/Application Support/PhotoWallpaper` (handoff) | `…/Application Support/Glimpse` |

**Keep**: every "Google Photos" that names Google's service (FR-002). **Don't edit**:
`specs/001`–`specs/005`.

---

## Phase 1: Setup

- [X] T001 Record the baseline:
  1. Run `npm test` and note the test count (232 expected).
  2. Run the quickstart step 1 grep and save its output to the scratchpad. It should list the
     25 files from research R1.

---

## Phase 2: Foundational

None. The stories share no blocking prerequisite. US2's contract renames (C1–C5) are made
whole within US2.

---

## Phase 3: User Story 1: Users see "Glimpse" (Priority: P1) 🎯 MVP

**Goal**: everywhere the app shows its own name, it says "Glimpse" (FR-001, FR-003, FR-004).

**Independent Test**: quickstart step 5, plus the screensaver's name in step 6.

- [X] T002 [P] [US1] In `package.json`, set `"name": "glimpse"` (N2) and
  `"productName": "Glimpse"` (N1). Then run `npm install` so `package-lock.json` takes the new
  name.
- [X] T003 [P] [US1] In `forge.config.js`, set packager `name: 'Glimpse'` (N1) and
  `appBundleId: 'com.yossieynav.glimpse'` (N3). Leave `extraResource` for T015 and T016.
- [X] T004 [P] [US1] In `src/main/main.ts`, replace the 4 display strings with:
  - `"Select 'Glimpse' in Screen Saver settings"`
  - `'Glimpse is turned off and your wallpaper is restored.'`
  - `'Glimpse could not start its wallpaper helper'`
  - `'Glimpse could not start'`

  Leave the resource paths for T015 and T016.
- [X] T005 [P] [US1] In `src/main/tray.ts`, set the tooltip `'Glimpse'`.
- [X] T006 [P] [US1] In `src/main/platform/loopback-server.ts`, change `DONE_PAGE` to use
  `<title>Glimpse</title>` and "return to Glimpse".
- [X] T007 [P] [US1] In `native/saver/Info.plist`, set `CFBundleName` to `Glimpse` (N9) and
  `CFBundleIdentifier` to `com.yossieynav.glimpse.saver` (N10).
- [X] T008 [P] [US1] In `native/saver/PhotoWallpaperSaverView.swift`, change the turned-off
  message to `"Glimpse is turned off in the menu"`, and the line-1 comment to "Shows the photo
  Glimpse is currently using as the wallpaper."
- [X] T009 [US1] Checkpoint: `npm test`, `npm run typecheck` and `npm run build` pass.

**Checkpoint**: users see only "Glimpse". The internal names are still old.

---

## Phase 4: User Story 2: One name across the repository (Priority: P2)

**Goal**: no live file uses the old name or its abbreviations (FR-005 to FR-008). Contracts
C1–C5 hold.

**Independent Test**: quickstart steps 1–4.

### Tests first (must fail before T014–T016)

- [X] T010 [P] [US2] In `tests/core/screensaver/installer.test.ts`, change every
  `PhotoWallpaperSaver.saver` to `Glimpse.saver`, and the executable path
  `Contents/MacOS/PhotoWallpaperSaver` to `Contents/MacOS/Glimpse` (N7, N8).
- [X] T011 [P] [US2] In `tests/core/screensaver/uninstall.test.ts`, set
  `SAVER = '/Users/me/Library/Screen Savers/Glimpse.saver'` and change the executable path to
  `Contents/MacOS/Glimpse`.
- [X] T012 [P] [US2] In `tests/core/screensaver/handoff.test.ts`, change `DIR` to end in
  `Application Support/Glimpse` (N12).
- [X] T013 [US2] Run `npm test`. Confirm the installer, uninstall and handoff tests now **fail**
  on the old paths. Record the failing test names.

### Implementation

- [X] T014 [US2] Rename the handoff folder on both sides in one change (C1):
  - In `src/core/screensaver/handoff.ts`, change `…/Application Support/PhotoWallpaper` to
    `…/Application Support/Glimpse`.
  - In `native/saver/PhotoWallpaperSaverView.swift`, change `"Library/Application
    Support/PhotoWallpaper"` and its doc comment to `Glimpse`.
- [X] T015 [US2] Rename the screensaver bundle and its class (C2, C3, C4):
  1. `git mv native/saver/PhotoWallpaperSaverView.swift native/saver/GlimpseSaverView.swift`.
  2. In that file, change `@objc(PhotoWallpaperSaverView)` and `final class
     PhotoWallpaperSaverView` to `GlimpseSaverView` (N11).
  3. In `native/saver/Info.plist`, set `CFBundleExecutable` to `Glimpse` (N8) and
     `NSPrincipalClass` to `GlimpseSaverView`.
  4. In `scripts/build-native.sh`'s `build_saver`, set `local name=Glimpse` and point it at the
     source `native/saver/GlimpseSaverView.swift`. Update the header comment to
     `build/Glimpse.saver`.
  5. In `forge.config.js` `extraResource`, use `'build/Glimpse.saver'`.
  6. In `src/main/main.ts:154-155`, use `'Glimpse.saver'`.
  7. In `src/core/screensaver/installer.ts:14` and `src/core/screensaver/uninstall.ts:6`, use
     `'Glimpse.saver'`.
- [X] T016 [US2] Rename the helper (C5, N6):
  - In `scripts/build-native.sh`, set the output to `build/glimpse-helper`, along with its
    sign and echo lines and the header comment.
  - In `forge.config.js` `extraResource`, use `'build/glimpse-helper'`.
  - In `src/main/main.ts:78`, set `command` to `glimpse-helper` (both branches).
  - In `native/helper/main.swift`:
    - change the line-1 comment to `// glimpse-helper: sets the macOS wallpaper for Glimpse.`
    - change the log prefix to `"glimpse-helper: …"`
    - change the usage text to `glimpse-helper --photos-dir <path>`
- [X] T017 [P] [US2] In `src/main/platform/helper-desktop.ts`, replace every `pw-helper` in
  doc comments, log text and error text with `glimpse-helper`.
- [X] T018 [P] [US2] Replace `pw-helper` with `glimpse-helper` in these comments:
  - `src/core/wallpaper/desktop.ts:8`
  - `src/core/wallpaper/helper-protocol.ts:1`
- [X] T019 [P] [US2] Replace `pw-helper` with `glimpse-helper` in these tests:
  - `tests/core/rotation/engine.test.ts:226` (comment)
  - `tests/core/rotation/external-change.test.ts:45` (comment)
  - `tests/support/fake-helper.mjs:1` (comment)
  - `tests/main/helper-desktop.test.ts:21` (temp dir prefix `'glimpse-helper-'`)

  If any helper-desktop test asserts on a log or error string changed by T017, update it to
  match.
- [X] T020 [P] [US2] Update the docs:
  - **README.md**:
    - title `# Glimpse`
    - the line-50 build outputs `build/glimpse-helper` and `build/Glimpse.saver`
    - line 64, "`glimpse-helper`, the wallpaper helper"
    - line 85, "Used to sign `glimpse-helper` and the screensaver"
    - line 98, select "Glimpse" in System Settings → Screen Saver
  - **PRIVACY.md**: change line 80 to `~/Library/Screen Savers/Glimpse.saver`. Leave "Last
    updated" alone, because it's only a path fix and no data handling changes.
- [X] T021 [P] [US2] In `.specify/memory/constitution.md`, delete the leftover Sync Impact
  Report HTML comment at the top. Nothing else changes.
- [X] T022 [US2] Verify:
  1. `rm -rf build/pw-helper build/PhotoWallpaperSaver.saver` (stale outputs), then
     `npm run build:native`.
  2. `npm test` passes, with T001's count or more. The T013 failures are now green.
  3. `npm run typecheck` passes.
  4. Quickstart step 3: plist values and the `GlimpseSaverView` symbol.
  5. Quickstart step 1: no matches.

**Checkpoint**: the repository uses one name, and contracts C1–C5 hold.

---

## Phase 5: User Story 3: The owner's old setup (Priority: P3)

**Goal**: Glimpse starts fresh, and the README explains the manual clean-up (FR-009).

**Independent Test**: quickstart steps 7–8.

- [X] T023 [US3] ~~Add an "Upgrading from Google Photos Wallpaper" section to `README.md`~~.
  The section was added and then **removed at the owner's request**. The clean-up is manual and
  undocumented, FR-009 was updated, and FR-007 has no exception.
- [ ] T024 [US3] Manual: quickstart steps 7–8 on this Mac.

**Checkpoint**: all user stories are complete.

---

## Phase 6: Polish & Cross-Cutting

- [X] T025 Final check, with quickstart steps 1, 2 and 4:
  - The grep finds nothing.
  - `grep -c google-photos-wallpaper package-lock.json` prints 0.
  - `npm run make` produces `out/Glimpse-darwin-universal/Glimpse.app` with bundle ID
    `com.yossieynav.glimpse`, and its Resources contain `glimpse-helper` and `Glimpse.saver`.
- [ ] T026 Manual: quickstart steps 5, 6 and 9 (the walkthrough, the screensaver showing the
  photo through C1, and every documented path existing).

---

## Dependencies & Execution Order

- **Setup (T001)** comes before everything else.
- **US1 (T002–T009)**: T002–T008 are in different files and can run in parallel. T009 comes
  after them.
- **US2 (T010–T022)**:
  - It runs after US1, because T014–T016 edit files US1 touched (`main.ts`,
    `forge.config.js`, `Info.plist` and the saver Swift file).
  - T010–T012 run in parallel, then T013 (red), then T014, T015 and T016 in sequence (they
    share `build-native.sh`, `forge.config.js`, `main.ts` and the saver file).
  - T017–T021 can run in parallel with each other once T016 is done.
  - T022 comes last.
- **US3 (T023–T024)**: after US2, because T020 and T023 both edit `README.md`.
- **Polish (T025–T026)**: after everything else.

## Parallel Example: User Story 1

```text
T002 package.json · T003 forge.config.js · T004 main.ts · T005 tray.ts ·
T006 loopback-server.ts · T007 Info.plist · T008 saver Swift message
```

## Parallel Example: User Story 2

```text
Tests first: T010 installer.test.ts · T011 uninstall.test.ts · T012 handoff.test.ts
After T016:  T017 helper-desktop.ts · T018 wallpaper comments · T019 test comments · T020 docs · T021 constitution
```

## Implementation Strategy

- **MVP**: US1 alone, T001–T009. Users see "Glimpse" everywhere, and it can ship on its own.
- **Then US2**: the internal names and docs, keeping C1 (the handoff folder) atomic.
- **Then US3**: the clean-up docs and manual checks.
- Commit after each story, so each checkpoint is a working build.
