---

description: "Task list for removing the automatic pause"
---

# Tasks: Glimpse never pauses on its own

**Input**: Design documents from `/specs/009-never-auto-pause/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R5), data-model.md,
contracts/rotation-and-menu.md (N1–N4), quickstart.md

**Tests**: test-first (Constitution I). The new tests are written and seen failing before the
code changes. Tests of the removed behavior are rewritten or deleted with it (research R4).
The expected final count is **219**.

**Organization**: by user story.
- **US1 (P1)**: rotation keeps going after a manual wallpaper change.
- **US2 (P2)**: only the user pauses.
- **US3 (P3)**: old auto-paused state is resumed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2, US3

---

## Phase 1: Setup

- [X] T001 Record the baseline:
  - `npm test` gives 220 passing.
  - `npm run typecheck` is clean.
  - Save the output of the quickstart step 3 grep to the scratchpad.

---

## Phase 2: Foundational

None. Each story owns its part.

---

## Phase 3: User Story 1: Rotation keeps going after a manual wallpaper change (Priority: P1) 🎯 MVP

**Goal**: FR-001, FR-002, FR-003, FR-005; contract N1–N3. **Independent Test**: quickstart steps
5–6.

### Tests first

- [X] T002 [US1] Rewrite `tests/core/rotation/external-change.test.ts`. Use the existing helpers
  (`makeEngine`, `MIN`, `signedInState`).
  - **Replace** "a wallpaper set outside the app pauses rotation…" with "a wallpaper set outside
    the app doesn't stop the next scheduled change (FR-001)":
    1. `start()`.
    2. Set `desktop.current` to `['/System/Library/Desktop Pictures/Sonoma.heic']`.
    3. Advance 30 min, then `tick()`.
    4. Assert that mode is `'running'`, `desktop.calls.length === 2`, `desktop.current[0]`
       starts with `/data/Photos/`, and `nextChangeAt === clock.now() + 30 * MIN`.
  - **Replace** "only one screen changed outside the app is enough to pause" with "with one of
    two screens changed, the next change sets every screen (FR-002)":
    1. Start with 2 screens. Pass `{ screens: 2 }` if `makeEngine` supports it; otherwise set
       `desktop.current` to two entries.
    2. Set the second entry to `/Users/me/Pictures/cat.jpg`.
    3. Advance 30 min, then `tick()`.
    4. Assert that mode is `'running'` and every `desktop.current` entry equals the last
       `desktop.calls` entry.
  - **Keep** "paths inside the app's Photos folder…", renamed "a Glimpse photo on screen: the
    next change happens as usual". The assertions stay the same.
  - **Delete**:
    - "a folder that merely starts with the Photos path is still external";
    - the three `externalChange()` tests (the Amendment A block).
- [X] T003 [P] [US1] In `tests/main/helper-desktop.test.ts`, replace "externalChange events are
  delivered to subscribers" with "externalChange events are logged and change nothing":
  1. Use `make({ FAKE_HELPER_EMIT_EXTERNAL: '1' })`, then `start()` and
     `set('/p/a.jpg')`.
  2. `waitFor` until `logged` has an entry with `level === 'info'` and a message containing
     `'changed outside Glimpse'`.
  3. Assert that no `logged` entry has `level === 'warn'` and the message
     `'glimpse-helper sent an invalid line'`.
  4. `stop()`.

  Don't call `onExternalChange`.
- [X] T004 [US1] Run `npm test`. Record which T002 and T003 tests **fail**: the first two T002
  tests and T003 are expected to. `typecheck` may also fail on T003 if it referenced the
  removed API; it doesn't, by design.

### Implementation

- [X] T005 [US1] In `src/core/rotation/engine.ts`:
  - Delete `changedOutsideApp`.
  - In `tick()`, delete the `if (await changedOutsideApp()) { … }` block, so a due running
    tick always calls `changePhoto()`.
  - Delete the `externalChange` method and its doc comment.
  - In `resume()`, change the guard to `if (state.rotation.mode !== 'paused') return;`.
  - If `sep` is now unused, keep it: `recordOriginals` still uses it.
- [X] T006 [US1] In `src/core/persistence/app-state.ts`, change `RotationMode` to
  `'stopped' | 'running' | 'paused' | 'blockedNoPhotos'`.
  - In `src/core/menu/menu-model.ts`, delete `case 'pausedExternalChange':` in `startItem` and
    in `statusLine`, together with the status text "Paused — wallpaper changed in System
    Settings" (contract N2).
  - In `tests/core/menu/menu-model.test.ts`, remove `'pausedExternalChange'` from the
    `startItem` and `status` helper types, and remove their two `pausedExternalChange`
    assertions.
  - In `tests/core/rotation/done-applies.test.ts`, delete the `['pausedExternalChange', …]`
    entry from the `for` list.
- [X] T007 [US1] Remove the event plumbing (research R2):
  - **`src/core/wallpaper/desktop.ts`**: delete `onExternalChange?` from `Desktop`.
  - **`src/main/main.ts`**: delete `desktop.onExternalChange(() => void engine.externalChange());`.
  - **`src/main/platform/helper-desktop.ts`**:
    - Delete `externalListeners` and the `onExternalChange` method.
    - In the event branch, replace the listener loop with
      `opts.log('info', 'The wallpaper was changed outside Glimpse; it stays until the next change', { paths: msg.paths })`.
    - If `opts.log` takes only `(level, message)`, drop the third argument.
  - Leave `src/core/wallpaper/helper-protocol.ts`, `tests/support/fake-helper.mjs` and
    `native/helper/` untouched.
- [X] T008 [US1] Checkpoint: `npm test` passes, including the T002 and T003 tests, and
  `npm run typecheck` is clean.

**Checkpoint**: a manual wallpaper no longer pauses Glimpse, and no menu status says it does.

---

## Phase 4: User Story 2: Only the user pauses or stops Glimpse (Priority: P2)

**Goal**: FR-004; contract N4. **Independent Test**: quickstart step 7.

- [X] T009 [US2] In `tests/core/rotation/external-change.test.ts`, add "while paused by the
  user, a manual wallpaper and a due tick change nothing":
  1. `start()`, then `pause()`.
  2. Set `desktop.current` to `['/Users/me/Pictures/cat.jpg']`.
  3. Advance 30 min, then `tick()`.
  4. Assert that mode is `'paused'`, `desktop.calls.length === 1`, and `desktop.current`
     still equals `['/Users/me/Pictures/cat.jpg']`.
  5. Then `resume()`, and assert that mode is `'running'`.

  This is a guard. It passes already, because user Pause was never affected. Run `npm test`
  and record that it passes.
- [X] T010 [US2] Confirm that nothing but Pause, Turn off, Sign out and the no-photos block
  sets a non-running mode:
  `grep -n "mode = '" src/core/rotation/engine.ts` shows only `'running'`, `'paused'` (in
  `pause`), `'blockedNoPhotos'` and the `'stopped'` resets in `stop`/`turnOff`. Record the
  lines.

---

## Phase 5: User Story 3: Users already auto-paused are resumed (Priority: P3)

**Goal**: FR-006, SC-004; data-model "Migration on load". **Independent Test**: quickstart
step 8.

### Tests first

- [X] T011 [P] [US3] In `tests/core/persistence/state-file.test.ts`, add two tests:
  - **"a legacy pausedExternalChange mode loads as running"**: write
    `/data/state.json` as
    `{ rotation: { mode: 'pausedExternalChange', currentPhotoId: 'p1', nextChangeAt: null } }`
    with `MemoryFileSystem`, load it, and assert that `rotation` deep-equals
    `{ mode: 'running', currentPhotoId: 'p1', nextChangeAt: null }`.
  - **"a saved paused mode stays paused"**: the same, with `mode: 'paused'`; assert that mode
    is `'paused'`.
- [X] T012 [US3] In `tests/core/rotation/external-change.test.ts`, add "a legacy auto-paused
  state shows a photo at launch and schedules the next change (FR-006)":
  1. Write `signedInState(['a', 'b'])` to a `MemoryFileSystem` with `saveState`, after setting
     `rotation` to `{ mode: 'pausedExternalChange', currentPhotoId: 'a', nextChangeAt: null }`.
     Cast the mode with `as never`, because the type no longer has it.
  2. Load it with `loadState`, then pass the result to `makeEngine` and call `restore()`.
  3. Assert that mode is `'running'`, `desktop.calls.length === 1`, and
     `nextChangeAt === clock.now() + 30 * MIN`.
- [X] T013 [US3] Run `npm test`. The first T011 test and T012 **fail**, because the mode loads
  unchanged and `restore()` ignores it. Record them.

### Implementation

- [X] T014 [US3] In `src/core/persistence/state-file.ts`, change the `mode` line to map the
  legacy value:

  ```ts
  // Feature 009 removed the automatic pause; a file saved in it resumes (research R3).
  mode: (parsed.rotation?.mode as string) === 'pausedExternalChange' ? 'running' : (parsed.rotation?.mode ?? d.rotation.mode),
  ```

  Keep `nextChangeAt` as loaded.
- [X] T015 [US3] Checkpoint: `npm test` passes, including T011 and T012.

---

## Phase 6: Polish & Cross-Cutting

- [X] T016 [P] In `README.md` lines 13–14, replace "If you pick a wallpaper yourself in System
  Settings, rotation pauses instead of overwriting it." with "If you pick a wallpaper yourself
  in System Settings, it stays until the next change." (FR-007).
- [X] T017 Run the automated checks from `specs/009-never-auto-pause/quickstart.md`:
  1. `npm test` passes **219** tests.
  2. `npm run typecheck` is clean.
  3. The step 3 grep returns nothing.
  4. `git diff --stat native/` is empty.
- [X] T018 Add a "Recorded results" section to `specs/009-never-auto-pause/quickstart.md`, with
  the T004, T009 and T013 runs and the T010 and T017 results.
- [ ] T019 Manual: quickstart steps 5–9.

---

## Dependencies & Execution Order

- T001 comes first.
- **US1**: T002 and T003 can run in parallel, then T004 (red), T005, T006, T007, and finally
  T008.
  - T005 must come before T006, because the engine still uses the mode.
  - T007 must come after T005, because `main.ts` calls `engine.externalChange`.
- **US2** needs US1: T009 edits the file T002 rewrote.
- **US3** needs US1: T006 removes the mode from the type, which T012's cast relies on.
  - T011 and T012 come before T013 (red), then T014 and T015.
- **Polish**: T016 can run any time. T017–T019 come last.

## Parallel Example: User Story 1

```text
Tests first: T002 external-change.test.ts · T003 helper-desktop.test.ts
```

## Implementation Strategy

- **MVP**: US1 (T001–T008). Glimpse no longer pauses on a manual change. This is the whole
  user-visible request.
- **Then US2**: a guard test and a check that only the user can pause.
- **Then US3**: the one-line migration for users updating while auto-paused.
- **Then Polish**: the README and the final checks.
- Commit after each story.
