---

description: "Task list for Apply New Photos on Done, and Turn Off"
---

# Tasks: Apply New Photos on Done, and Turn Off

**Input**: Design documents from `/specs/004-apply-on-done-and-turn-off/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/wallpaper-helper-restore.md, contracts/menu-power.md, quickstart.md

**Tests**: REQUIRED (Constitution Principle I). Each test task comes before its implementation
and must be seen failing first.
- **Engine tests**: use `tests/support/engine.ts` (`makeEngine`, `ManualClock`, `FakeDesktop`,
  `MemoryFileSystem`, seeded random).
- **Helper tests**: use the fake helper script, and never touch the real wallpaper.

**Organization**: by user story. Both stories are P1.
- **US1**: Done applies new photos.
- **US2**: Turn off and Turn on.

US1 doesn't depend on US2. US2 doesn't depend on US1 either, except that both edit `engine.ts`,
so they must run in sequence there.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2

## Naming note

The engine already has a `restore()` method, which re-applies the current photo at launch
(feature 001). The new wallpaper-restoring operation is on the **desktop**, as `desktop.restore(paths)`,
and on the helper. The engine's new public methods are `turnOff()` and `turnOn()`. Don't rename
the existing `engine.restore()`.

---

## Phase 1: Setup

- [X] T001 Record the baseline: run `npm test` (196 tests at the time of writing),
  `npm run typecheck`, `npm run build` and `npm run build:native`, and check that all pass.

---

## Phase 2: Foundational

There are no shared prerequisites. Each story's model changes live in its own phase.

---

## Phase 3: User Story 1 - New photos show up as soon as I click Done (Priority: P1) 🎯 MVP

**Goal**: Done with newly added photos shows a random one of them at once, on the wallpaper and
the screensaver, and sets the rotation running. If none has finished downloading, the first one
to finish is shown.

**Independent Test**: Quickstart scenarios 1–5, plus `tests/core/rotation/done-applies.test.ts`.

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T002 [P] [US1] Extend `tests/core/library/selection-draft.test.ts`:
  - **`commit()` returns `addedIds`**: these are the IDs added through `addPicked` in this draft
    and still present. Example: start from `a`, `b`; add `c`, `d`; remove `d`, then commit. The
    result is `addedIds = ['c']`, with `removedIds` unchanged.
  - **Nothing added**: a draft with no additions gives `addedIds = []`.
- [X] T003 [P] [US1] Create `tests/core/rotation/done-applies.test.ts`, using
  `makeEngine(signedInState([...]))`. Write the saved JPEGs for the "added" photos too, since
  `makeEngine` writes one file per photo in the initial state. Cover data-model.md "Done with
  new photos":
  - **Running**: with `a` and `b` showing, add `c` and `d` (status `saved`) through
    `engine.update`, then call `engine.selectionChanged({addedIds: ['c', 'd']})`.
    `desktop.calls.at(-1)` is `c` or `d`, and `nextChangeAt === clock.now() + 30 * MIN`.
  - **From `stopped`, `paused` and `pausedExternalChange`** (one test each): the same call ends
    with `mode === 'running'` and a new photo on screen.
  - **Only added photos are candidates**: with `seededRandom`, over 20 trials of a fresh engine
    whose selection is `a`–`e` plus added `x` and `y`, every pick is `x` or `y`.
  - **Screensaver**: with `useForScreensaver` on and a fake handoff, the new photo is published.
  - **Pending**: with `c` added as `pending`, `selectionChanged({addedIds: ['c']})` leaves the
    wallpaper unchanged and sets `mode = 'running'`. Then `engine.photoStatusChanged('c', 'saved')`
    (after writing `c`'s JPEG) shows `c` at once.
  - **All failed**: with `c` and `d` added as `pending` and `currentPhotoId` null, both
    `photoStatusChanged(…, 'unavailable')` calls clear `pendingShow`. If `a` is saved, a normal
    change shows `a`.
  - **Invalid file**: added `c` is `saved` but its file is missing. It's marked `unavailable`,
    and the other added photo, `d`, is shown.
  - **Nothing added**: `selectionChanged({addedIds: []})` and `selectionChanged()` (no argument)
    make no `desktop.set` call, and keep `mode` and `nextChangeAt` unchanged.
  - **`photoStatusChanged` updates status**: for a photo that's not in `pendingShow`, the photo's
    status in the selection is updated, with no wallpaper change.
- [X] T004 [P] [US1] Extend `tests/core/library/selection-session.test.ts`:
  - **Commit passes the added photos**: after `pick()` (4 photos added) and `commit()`, the
    `onSelectionCommitted` callback gets
    `{addedIds: ['item-1', 'item-2', 'item-4', 'item-5']}`.
  - **Download updates go to the engine**: the `update({id: 'item-1', status: 'saved'})` helper
    results in `engine.photoStatusChanged('item-1', 'saved')`. Use a spy that wraps the real
    engine's `photoStatusChanged`.
  - Change the session's `engine` dependency type to
    `Pick<RotationEngine, 'getState' | 'update' | 'photoStatusChanged'>` in the test's setup.

### Implementation for User Story 1

- [X] T005 [US1] In `src/core/library/selection-draft.ts`, `commit()` returns
  `{selection, removedIds, addedIds}`, where `addedIds` is `[...#addedIds]` filtered to the IDs
  still in `this.photos`. Makes T002 pass.
- [X] T006 [US1] In `src/core/rotation/engine.ts`:
  - **`pendingShow`**: add a `let pendingShow: Set<string> | null = null`, held in memory only.
  - **`changePhotoAmong(ids)`**: refactor `changePhoto` into this, so it can be restricted to a
    set of IDs. `changePhoto()` calls `changePhotoAmong(null)`, meaning all photos. Pick with
    `pickRandom(currentPhotoId, {photos: candidates, skippedNonPhotoCount: 0}, random)`, and keep
    the `isValidJpeg` loop and the `set` failure handling.
  - **`selectionChanged(opts?: {addedIds?: string[]})`**: keep the existing removal handling.
    Then, when `addedIds` isn't empty, follow data-model.md "Done with new photos" steps 1–4.
  - **Add `photoStatusChanged(id, status)`**: it updates the photo's status, then applies the
    data-model rules for `pendingShow`.

  Makes T003 pass, and keeps every existing engine test passing.
- [X] T007 [US1] In `src/core/library/selection-session.ts`:
  - the `engine` dependency becomes `Pick<RotationEngine, 'getState' | 'update' | 'photoStatusChanged'>`
  - `applyUpdate` returns `deps.engine.photoStatusChanged(u.id, u.status)` instead of its inline
    `engine.update` mutation
  - `onSelectionCommitted?(info: {addedIds: string[]}): Promise<void>`, and `commit()` passes the
    draft's `addedIds`

  Makes T004 pass.
- [X] T008 [US1] In `src/main/main.ts`, change
  `onSelectionCommitted: () => engine.selectionChanged()` to
  `onSelectionCommitted: ({addedIds}) => engine.selectionChanged({addedIds})`. Then run
  `npm test`, `npm run typecheck` and `npm run build`; all must pass.
- [ ] T009 [US1] Manual check (needs a person): quickstart scenarios 1–5. Record the results in
  `specs/004-apply-on-done-and-turn-off/quickstart.md`.

**Checkpoint**: Done shows new photos at once.

---

## Phase 4: User Story 2 - Turn the app off and get my Mac back (Priority: P1)

**Goal**: A persisted on/off state.
- **Turn off**: restores the original wallpaper on displays still showing app photos, through the
  helper's `restore`, removes our screensaver, guides the user, and keeps the setup. While off,
  nothing changes the wallpaper or screensaver.
- **Turn on**: records new originals and runs the rotation.
- **Menu**: `turnOff`, plus the off menu.

**Independent Test**: Quickstart scenarios 6–10, plus `tests/core/rotation/power.test.ts`.

### Tests for User Story 2 ⚠️ write first, confirm they fail

- [X] T010 [P] [US2] Extend `tests/core/persistence/state-file.test.ts`:
  - **Defaults**: `defaultState()` includes `power: 'on'` and `original: null`. Update the existing
    `defaults match the data model` assertions to match.
  - **Round-trip**: `power: 'off'` and
    `original: {wallpapers: ['/x.heic', null], recordedAt: 5}` survive save and load.
  - **Older files**: a `state.json` without `power` or `original` loads with `power: 'on'` and
    `original: null`.
- [X] T011 [P] [US2] Extend `tests/core/wallpaper/helper-protocol.test.ts`:
  - **Encoding**: `encodeRequest({id: 7, cmd: 'restore', paths: ['/a.heic', null]})` returns
    exactly `'{"id":7,"cmd":"restore","paths":["/a.heic",null]}\n'`.
  - **Response**: `parseLine('{"id":7,"ok":true,"restored":2}')` returns
    `{type: 'response', id: 7, ok: true, restored: 2}`.
  - **Rejected**: `restored` that isn't a number gives `invalid`.
- [X] T012 [P] [US2] Extend `tests/support/fake-helper.mjs`:
  - **`restore`**: sets `current = null`, records `restoreTargets = req.paths`, and answers
    `{id, ok: true, restored: <number of paths>}`.
  - **`get` after a restore**: returns `paths: [restoreTargets[0] ?? '/System/Library/CoreServices/DefaultDesktop.heic']`.
  - The existing behavior switches (`FAKE_HELPER_*`) apply to `restore` too.
- [X] T013 [US2] Extend `tests/main/helper-desktop.test.ts`, which needs T012:
  - **Restore round trip**: `desktop.restore(['/a.heic', null])` sends `restore` with those
    paths, checked in the fake's request log. It resolves to the restored count.
  - **Replay after a restart**: if the last wallpaper command was `restore`, a helper restart
    re-sends `restore` with the same paths, **not** `show`. Use `FAKE_HELPER_CRASH_ON=get`: call
    `set`, then `restore`, then `get`, which crashes the fake. Check that the second process's
    log contains a `restore`, and no `show`.
- [X] T014 [P] [US2] Create `tests/core/screensaver/uninstall.test.ts` for
  `uninstallSaver({fs, home})` from `src/core/screensaver/uninstall.ts`:
  - It removes `<home>/Library/Screen Savers/PhotoWallpaperSaver.saver`, including everything
    inside it, using `MemoryFileSystem`.
  - It resolves without error when the saver isn't installed.
- [X] T015 [P] [US2] Create `tests/core/rotation/power.test.ts`. Extend `FakeDesktop` in
  `src/core/wallpaper/desktop.ts` with
  `restore(paths: (string | null)[]): Promise<number>`. It records `restoreCalls`, sets each
  `current[i]` that starts with `/data/Photos/` to `paths[i] ?? '/System/Library/CoreServices/DefaultDesktop.heic'`,
  and returns the count. That edit is test support, so it belongs here. Cover:
  - **Recording originals**: with `state.original === null` and `desktop.current` set to
    `['/Users/me/Pictures/mine.jpg']`, the first `start()` stores
    `original.wallpapers = ['/Users/me/Pictures/mine.jpg']` **before** the first set. A
    `desktop.current` already inside `/data/Photos/` records `[null]`.
  - **Only once**: a second `start()` after `stop()` doesn't record the originals again.
  - **`turnOff()`**:
    - sets `power = 'off'` and the rotation to stopped
    - calls `desktop.restore(original.wallpapers)` once
    - with `useForScreensaver` on, calls `handoff.disable()`
    - leaves `account`, `selection` and `settings` unchanged (FR-010)
  - **While off** (FR-011): `tick()` after a full interval, `next()`, `start()`, `resume()`,
    `restore()`, `displaysChanged()`, `photoStatusChanged(id, 'saved')` and
    `selectionChanged({addedIds: [...]})` make no `desktop.set` call and no `handoff.publish`
    call.
  - **`turnOn()`**: sets `power = 'on'`, records the originals again from `desktop.get()`,
    shows a photo (`desktop.calls` grows by 1), and sets `mode = 'running'`.
  - **`turnOn()` with no saved photos**: `power = 'on'`, `mode` stays `'stopped'`, and there's
    no set.
  - **Persistence**: `save` was called with `power: 'off'` after `turnOff()`.
- [X] T016 [P] [US2] Extend `tests/core/menu/menu-model.test.ts`, following
  contracts/menu-power.md:
  - **Signed in and on**: the full menu order now includes a separator and then
    `{kind: 'action', id: 'turnOff', label: 'Turn off', enabled: true}` between `toggleLogin` and
    the separator before the email. Update the existing `signed in shows every item in contract
    order` expectation.
  - **Off**: with `power = 'off'`, the menu is exactly:
    - `{label 'Turned off — your wallpaper is restored'}`
    - a separator
    - `{action turnOn 'Turn on' enabled: true}`
    - a separator
    - the email label
    - `signOut`
    - `quit`

    `turnOn` is disabled when no photo is saved.
  - **Off with `needsReauth`**: the `signIn` notice is still the first item.
  - **Off, other notices**: low-disk, offline and unavailable-photo notices are not shown.

### Implementation for User Story 2

- [X] T017 [US2] Update the model and saved-state loading:
  - **`src/core/persistence/app-state.ts`**:
    - add `export type Power = 'on' | 'off'`
    - add `export type OriginalWallpapers = { wallpapers: (string | null)[]; recordedAt: number }`
    - add the `AppState` fields `power: Power` and `original: OriginalWallpapers | null`
    - add `power: 'on'` and `original: null` to `defaultState()`
  - **`src/core/persistence/state-file.ts`**: load
    `power: parsed.power === 'off' ? 'off' : 'on'` and
    `original: parsed.original ?? null`.

  Makes T010 pass.
- [X] T018 [P] [US2] In `src/core/wallpaper/helper-protocol.ts`:
  - add `{id, cmd: 'restore', paths: (string | null)[]}` to `HelperRequest`
  - let a successful response carry an optional `restored: number`, checking its type

  Makes T011 pass.
- [X] T019 [US2] Add `restore?(paths: (string | null)[]): Promise<number>` to the `Desktop` type
  in `src/core/wallpaper/desktop.ts`. Then, in `src/main/platform/helper-desktop.ts`:
  - implement `restore(paths)`, which sends `restore` and resolves to `restored ?? 0`
  - track `lastWallpaperCommand: {cmd: 'show', path} | {cmd: 'restore', paths} | null`, set by
    `set` and `restore`, and cleared by `clear`
  - after a restart, re-send that command, replacing the current "re-show `lastShown`" logic

  Makes T013 pass.
- [X] T020 [P] [US2] Create `src/core/screensaver/uninstall.ts`, exporting
  `uninstallSaver({fs, home})`, which calls
  `fs.remove(join(home, 'Library', 'Screen Savers', 'PhotoWallpaperSaver.saver'))`. Makes T014
  pass.
- [X] T021 [US2] In `src/core/rotation/engine.ts`:
  - **Recording originals**: add `recordOriginals()`. It runs `desktop.get()`, maps paths that
    start with `photosDir + sep` to `null`, and sets
    `state.original = {wallpapers, recordedAt: clock.now()}`. If `desktop.get()` throws, it logs
    at `warn` and stores `{wallpapers: [], recordedAt}`.
  - **Before the first change**: in `changePhotoAmong`, if `state.original === null`, call
    `recordOriginals()` before the first `desktop.set`.
  - **Power guard**: a `const isOff = () => state.power === 'off'` check returns early in
    `start`, `tick`, `next`, `resume`, `restore`, `displaysChanged`, `photoStatusChanged` (it
    still updates the status), and the Done handling in `selectionChanged`.
  - **`turnOff()`**: runs in the engine queue.
    1. `pendingShow = null`
    2. `rotation = {mode: 'stopped', currentPhotoId: null, nextChangeAt: null}`
    3. `await deps.desktop.restore?.(state.original?.wallpapers ?? [])`, catching and logging
       errors so that Turn off still completes
    4. if `useForScreensaver`, `await deps.handoff?.disable()`
    5. `state.power = 'off'`
  - **`turnOn()`**:
    1. `state.power = 'on'`
    2. `await recordOriginals()`
    3. if any photo is saved, `mode = 'running'` and `changePhoto()`

  Makes T015 pass.
- [X] T022 [US2] In `src/core/menu/menu-model.ts`:
  - add the `turnOff` item and its separator to the signed-in, on menu
  - add the off menu
  - while off, show only the `needsReauth` notice (contracts/menu-power.md)

  Makes T016 pass.
- [X] T023 [US2] Add the `restore` command to `native/helper/main.swift`, following
  contracts/wallpaper-helper-restore.md:
  - **Parsing**: read `paths` as `[Any]`, where each entry is a `String` or `NSNull`.
  - **Restoring**: for each `NSScreen.screens[i]`:
    - if its current URL path is inside `photosDir`, find the target: `paths[i]`, if it's an
      existing regular file, or else `/System/Library/CoreServices/DefaultDesktop.heic`
    - set the target with `setDesktopImageURL(url, for: screen, options: [:])`, and set
      `lastSelfSet`
    - count the displays changed
  - **State**: set `current = nil` and `latched = false`, and store
    `restoreTargets = paths as [String?]`.
  - **Space and display changes**: in `reapply(reason:)`, when `current == nil` and
    `restoreTargets != nil`, apply the same restore rule to displays still showing a
    `photosDir` file. Send no `applied` event.
  - **`show`**: clears `restoreTargets`.
  - **Response**: `{"id", "ok": true, "restored": n}`.

  Run `npm run build:native`. Then run this read-only check, which uses a temporary photos-dir
  that no display shows, so nothing changes:
  `D=$(mktemp -d); printf '{"id":1,"cmd":"restore","paths":[null]}\n' | build/pw-helper --photos-dir "$D"`
  It must print `ready`, then `{"id":1,"ok":true,"restored":0}`.
- [ ] T024 [US2] In `src/main/main.ts`, add the `turnOff` and `turnOn` handlers:
  - **`turnOff`**:
    1. `windows.close('selection')`, which discards any pick
    2. `const wasScreensaver = engine.getState().settings.useForScreensaver`
    3. `await engine.turnOff()`
    4. if `wasScreensaver`, `await uninstallSaver({fs, home: app.getPath('home')})`
    5. if `wasScreensaver`, a non-blocking
       `dialog.showMessageBox({type: 'info', message: <contracts/menu-power.md Turn off text>, buttons: ['Open Screen Saver Settings', 'OK'], defaultId: 1})`.
       If the response is 0, call `shell.openExternal(SCREEN_SAVER_SETTINGS_URL)`.
  - **`turnOn`**: `await engine.turnOn()`. If `useForScreensaver` is on, run the existing
    `toggleScreensaver`-on flow: `installSaver`, then the "select it" message, without
    toggling the setting.
  - **Launch**: on launch, `engine.restore()` already returns early while off. Check that the
    tray menu renders the off menu.

  Then run `npm test`, `npm run typecheck` and `npm run build`; all must pass.
- [ ] T025 [US2] Manual check (needs a person): quickstart scenarios 6–10. Record the results in
  `specs/004-apply-on-done-and-turn-off/quickstart.md`.

**Checkpoint**: Turn off restores the Mac and stays off. Turn on resumes.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T026 [P] Add pointers to feature 004 from feature 001's contracts:
  - **`specs/001-photos-wallpaper-rotation/contracts/menu-ui.md`**: under "Signed in (FR-003)",
    add one line: "Feature 004 adds **Turn off** and an off-state menu; see
    `specs/004-apply-on-done-and-turn-off/contracts/menu-power.md`."
  - **`specs/001-photos-wallpaper-rotation/contracts/wallpaper-helper.md`**: under "Requests",
    add one line: "Feature 004 adds `restore`; see
    `specs/004-apply-on-done-and-turn-off/contracts/wallpaper-helper-restore.md`."
- [ ] T027 [P] In `README.md`'s feature list, add a bullet: "**Turn off**: one click in the menu
  stops the app and puts back the wallpaper you had before; Turn on picks up where you left off."
  Also mention that new photos appear as soon as you click Done.
- [ ] T028 Spikes (manual, need a person): quickstart scenarios 11 (S1, Aerial and dynamic
  restore) and 12 (S2, what the screensaver shows after our saver is removed). Record the results
  in research.md R2 and R3. If S2 shows a broken screensaver, apply the R3 fallback:
  - in the `turnOff` handler in `src/main/main.ts`, skip `uninstallSaver`
  - change the message to "Choose another screensaver in System Settings → Screen Saver."
- [ ] T029 Final checks:
  - `npm test`, `npm run typecheck`, `npm run build` and `npm run build:native` all pass
  - `grep -rl "from 'electron'" src/core` finds nothing
  - `pgrep -fl fake-helper` finds no leftover processes

---

## Dependencies & Execution Order

- **T001** comes first.
- **US1**:
  - T002, T003 and T004 are [P].
  - T005 needs T002. T006 needs T003. T007 needs T004 and T006, because it calls
    `photoStatusChanged`.
  - T008 needs T005–T007. T009 needs T008.
- **US2**:
  - T010, T011, T012, T014, T015 and T016 are [P]. T013 needs T012.
  - T017 needs T010. T018 needs T011. T019 needs T013 and T018. T020 needs T014.
  - **T021 needs T015 and T017, and must come after T006**, since both edit `engine.ts`.
  - T022 needs T016 and T017. T023 is independent (Swift). T024 needs T019–T023.
  - T025 needs T024.
- **Polish**: T026 and T027 are [P], after T024. T028 needs T024. T029 is last.

### Parallel Opportunities

- US1 tests: T002, T003 and T004.
- US2 tests: T010, T011, T012, T014, T015 and T016.
- US2 implementation: T018 and T020, alongside T017. The Swift task T023 can run alongside the
  TypeScript tasks.
- Polish: T026 and T027.

### Parallel Example: User Story 2

```bash
Task: "T010 state-file power/original tests in tests/core/persistence/state-file.test.ts"
Task: "T011 restore encoding tests in tests/core/wallpaper/helper-protocol.test.ts"
Task: "T015 power tests in tests/core/rotation/power.test.ts"
Task: "T016 off-menu tests in tests/core/menu/menu-model.test.ts"
Task: "T023 restore command in native/helper/main.swift"
```

---

## Implementation Strategy

### MVP First

1. T001.
2. US1 (T002–T008): Done applies new photos. It's small and ships on its own.
3. **Stop and check**: T009.

### Incremental Delivery

1. US1.
2. US2 (T010–T024): power state, restore, the off menu, and the screensaver handling.
3. Spikes T028, then the polish tasks.

---

## Notes

- No new dependencies.
- `power` and `original` are stored in `state.json`. `pendingShow` is held in memory only.
- Commit after each green step.
