---

description: "Task list for removing the screensaver"
---

# Tasks: Remove the screensaver

**Input**: Design documents from `/specs/008-remove-screensaver/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R5), data-model.md,
contracts/menu-and-package.md (M1–M3), quickstart.md

**Tests**: test-first (Constitution I). These are written and seen failing before the code
changes:
- the new menu test (no screensaver option)
- the new state-file test (a legacy setting is dropped)
- the flipped package check (no `Glimpse.saver`)

Tests of deleted behavior are deleted with it, as listed in research R4. The expected final
count is **220**.

**Organization**: by user story.
- **US1 (P1)**: the menu and app text.
- **US2 (P2)**: no screensaver code, bundle or docs.
- **US3 (P3)**: leftovers are left alone.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2, US3

---

## Phase 1: Setup

- [X] T001 Record the baseline:
  - `npm test` gives 232 passing.
  - Run the quickstart step 3 grep and save the per-file counts to the scratchpad. That's 26
    files today.

---

## Phase 2: Foundational

None. Each story removes its own part.

---

## Phase 3: User Story 1: The menu no longer offers the screensaver (Priority: P1) 🎯 MVP

**Goal**: FR-001 and FR-003, contract M1 and M2. **Independent Test**: quickstart steps 5–6.

- [X] T002 [US1] Test first, in `tests/core/menu/menu-model.test.ts`:
  1. Add the test "the menu has no screensaver option". For signed out, signed in, and off
     (`power: 'off'`), no item (including submenu items) has `id === 'toggleScreensaver'` or a
     label matching `/screensaver/i`.
  2. Delete the test "the screensaver toggle reflects the setting".
  3. Remove the `toggleScreensaver` item from the expected full signed-in menu.
- [X] T003 [US1] Run `npm test`. The new test and the full-menu test **fail**. Record them.
- [X] T004 [US1] In `src/core/menu/menu-model.ts`, remove the
  `{ kind: 'toggle', id: 'toggleScreensaver', … }` line. The menu then matches M1.
- [X] T005 [US1] In `src/main/main.ts`:
  1. Delete the `toggleScreensaver` handler and `installAndGuideSaver`.
  2. Make `turnOff` only `windows.close('selection'); await engine.turnOff();`, with no dialog
     (M2, R3).
  3. Make `turnOn` only `await engine.turnOn();`.
  4. Remove the now-unused imports `installSaver`, `SCREEN_SAVER_SETTINGS_URL` and
     `uninstallSaver`.

  Keep `handoff` for now; T012 removes it.
- [X] T006 [US1] Checkpoint: `npm test` passes (T002's tests are green) and `npm run typecheck`
  is clean.

**Checkpoint**: users can't see the screensaver anywhere. The engine still has dead
screensaver code.

---

## Phase 4: User Story 2: No screensaver code, bundle or docs (Priority: P2)

**Goal**: FR-002, FR-004, FR-005 and FR-007, data-model.md, contract M3. **Independent Test**:
quickstart steps 2–4, 7 and 9.

### Tests first

- [X] T007 [P] [US2] In `tests/core/persistence/state-file.test.ts`:
  - Change the default-settings expectation to `{ intervalMinutes: 30, startAtLogin: false }`.
  - Add "a legacy useForScreensaver setting is dropped on load". Write a `state.json` whose
    settings are `{ intervalMinutes: 15, useForScreensaver: true, startAtLogin: true }`. Load
    it, then assert that settings deep-equal `{ intervalMinutes: 15, startAtLogin: true }`,
    with no `useForScreensaver` key.
- [X] T008 [P] [US2] In `scripts/check-package.sh`:
  - Remove `Glimpse.saver` from the "bundles" loop.
  - Add `check "no screensaver bundled" test ! -e "$app/Contents/Resources/Glimpse.saver"`.
- [X] T009 [US2] Show the failures:
  - `npm test` fails both T007 tests.
  - `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app` fails "no screensaver
    bundled", because the current package still has it.

  Record both.

### Implementation

- [X] T010 [US2] In `src/core/persistence/app-state.ts`:
  - Remove `useForScreensaver` from `RotationSettings` and from `defaultState()`.
  - Change the `Power` comment to "Turned off, the app leaves the wallpaper alone (feature
    004)."

  In `src/core/persistence/state-file.ts`, build settings from the known keys only:
  `{ intervalMinutes: parsed.settings?.intervalMinutes ?? d.settings.intervalMinutes, startAtLogin: parsed.settings?.startAtLogin ?? d.settings.startAtLogin }` (R2).
- [X] T011 [US2] In `src/core/rotation/engine.ts`, remove:
  - the `handoff` dependency and the `Handoff` import
  - `publishToScreensaver` and its call after a photo is shown
  - `setUseForScreensaver`
  - the `turnOff` screensaver branch

  Also reword the comments: "nothing may change the wallpaper", and the `turnOff` doc comment
  without the screensaver. Update the tests in the same task:
  - `tests/core/rotation/engine.test.ts`: delete the "US2: screensaver handoff" block
    (`fakeHandoff` and its 3 tests).
  - `tests/core/rotation/done-applies.test.ts`: delete "the screensaver gets the new photo".
  - `tests/core/rotation/power.test.ts`:
    - Remove `fakeHandoff`.
    - Rename the first test to "turnOff restores the originals, stops, and keeps the setup",
      and drop its handoff assertions.
    - Rename the second test to "while off, nothing changes the wallpaper (FR-011)", and drop
      its handoff parts.
    - Keep every wallpaper assertion.

  If `makeEngine` in the test support takes a `handoff` option, remove it.
- [X] T012 [US2] Edit the sign-out code and the main process:
  - **`src/core/auth/sign-out.ts`**:
    - Remove the `handoff` parameter, `deps.handoff?.disable()` and the `Handoff` import.
    - Change the doc comment to "deletes every local copy and the tokens".
  - **`tests/core/auth/sign-out.test.ts`**: delete "sign-out turns off the screensaver
    handoff".
  - **`src/main/main.ts`**:
    - Remove `createHandoffWriter` and `defaultHandoffDir`.
    - Remove the `handoff` const and `handoff` from `createRotationEngine({...})` and
      `signOut({...})`.
- [X] T013 [US2] Delete the screensaver module and its tests:
  - `git rm -r src/core/screensaver tests/core/screensaver`
  - Confirm nothing imports them: `grep -rn "screensaver/" src tests` is empty.
- [X] T014 [US2] Remove the native screensaver:
  - `git rm -r native/saver`.
  - In `scripts/build-native.sh`:
    - Delete `build_saver` and its call.
    - Change the header comment to list only `build/glimpse-helper`, and "Builds the native
      piece".
    - Change "Both are universal" to "It is universal".
  - In `forge.config.js`, change `extraResource` to `['build/glimpse-helper', 'config/google.json']`.
  - Then `rm -rf build/Glimpse.saver`.
- [X] T015 [P] [US2] In `README.md`:
  - Line 3: "rotates your desktop wallpaper through photos…".
  - Delete the "**Screensaver**" bullet.
  - The `build:native` line: "builds build/glimpse-helper with swiftc".
  - "`native/` holds the wallpaper helper" (one piece). Delete the `native/saver/` bullet.
  - `DEVELOPER_ID`: "Used to sign `glimpse-helper`".
  - Delete the "**Screensaver setup.**" known limitation.
- [X] T016 [P] [US2] In `PRIVACY.md`, remove every screensaver statement:
  - line 10: "…as your Mac's wallpaper."
  - line 32: "set your picked photos as your wallpaper;"
  - line 48: delete the screensaver copy bullet
  - lines 73–74: delete the "Turn off the screensaver option…" bullet
  - line 75: drop "(including the screensaver's)"
  - lines 79–80: drop the screensaver bundle sentence

  Set "Last updated" to 2026-11-01.
- [X] T017 [P] [US2] In `TERMS.md` line 15–16, change the text to "It shows photos you pick from
  Google Photos as your wallpaper. It changes the photo at the interval you set." Set "Last
  updated" to 2026-11-01.
- [X] T018 [P] [US2] In `package.json`, change `description` to "Rotate your macOS wallpaper
  through photos you choose from Google Photos."
- [X] T019 [US2] Verify:
  1. `npm test` passes **220** tests (R4). The T009 failures are now green.
  2. `npm run typecheck` is clean.
  3. Quickstart step 3: only the 3 allowed files match.
  4. `npm run build:native` produces only `build/glimpse-helper`.
  5. Run `npm run make`. `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app`
     passes all checks, including "no screensaver bundled".

**Checkpoint**: the screensaver is gone from the code, the package and the docs.

---

## Phase 5: User Story 3: Leftovers are left alone (Priority: P3)

**Goal**: FR-008. **Independent Test**: quickstart step 8.

- [X] T020 [US3] Confirm that no live code refers to `Screen Savers`, `legacyScreenSaver` or
  `Glimpse.saver`, except the package check's "must not be bundled" line:
  `grep -rnI "Screen Savers\|legacyScreenSaver\|Glimpse.saver" src scripts forge.config.js`.
  So nothing can read, change or delete the old files.
- [ ] T021 [US3] Manual: quickstart step 8 on a Mac with the old screensaver installed.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T022 Manual: quickstart steps 5, 6, 7 and 9.
- [X] T023 Add a "Recorded results" section to `specs/008-remove-screensaver/quickstart.md`,
  with the T003 and T009 failures, the T019 counts and checks, and T020.

---

## Dependencies & Execution Order

- T001 comes first.
- **US1**: T002 → T003 (red) → T004, then T005 → T006.
- **US2** needs US1, since T012 edits `main.ts` after T005.
  - T007 and T008 can run in parallel, then T009 (red).
  - Then T010 → T011 → T012 → T013 → T014, in sequence: each one removes code the next
    depends on, and `typecheck` has to stay meaningful.
  - T015–T018 are in different files and can run in parallel, any time after T009.
  - T019 comes last.
- **US3** needs US2.
- **Polish** comes after everything else.

## Parallel Example: User Story 2

```text
Tests first: T007 state-file.test.ts · T008 check-package.sh
Docs:        T015 README.md · T016 PRIVACY.md · T017 TERMS.md · T018 package.json
```

## Implementation Strategy

- **MVP**: US1 (T001–T006). The option disappears from the menu and the dialogs.
- **Then US2**: remove the dead code, the native bundle and the docs. This changes the Privacy
  Policy, so publish the new date.
- **Then US3**: verification only.
- Commit after each story.
