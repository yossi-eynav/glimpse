---

description: "Task list for Fully Random Photo Picks"
---

# Tasks: Fully Random Photo Picks

**Input**: Design documents from `/specs/002-random-photo-picks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md. There is no
contracts/, because no interface changes.

**Tests**: REQUIRED (Constitution Principle I, Test-First). Every test task comes before the
implementation task that makes it pass, and must be run (`npm test`) and seen failing first.
Randomness is tested only with the seeded `seededRandom()` from `tests/support/state.ts`, or with
a scripted `random`, never with `Math.random` (research R4).

**Organization**: grouped by user story. The behavior change is all in US1. US2 confirms that the
screensaver still follows the wallpaper.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2

## Conventions

The same as feature 001:
- TypeScript in `src/core/**`, with erasable syntax only and `.ts` import extensions.
- Tests in `tests/**/*.test.ts` with `node:test` and `node:assert/strict`.
- `npm test`, `npm run typecheck` and `npm run build`.

---

## Phase 1: Setup

- [X] T001 Record the baseline: run `npm test`, `npm run typecheck` and `npm run build`, and check
  that all pass (176 tests at the time of writing). Then run
  `grep -rn shownThisRound src tests | wc -l` and note the count, so later tasks can show it
  dropping to 0.

---

## Phase 2: Foundational

There are no foundational tasks. The feature changes existing modules only, and the round-state
removal is part of US1, since its tests drive it.

---

## Phase 3: User Story 1 - Each change shows a randomly picked photo (Priority: P1) 🎯 MVP

**Goal**: Every change (interval, Next photo, start, resume, catch-up after launch or wake, and
re-picking after an unavailable photo) picks uniformly at random from the saved photos. When 2 or
more are available, it excludes the photo on screen. There are no rounds, and no
`shownThisRound` anywhere.

**Independent Test**: Quickstart scenarios 1–5, plus `npm test` with the new
`random-pick.test.ts`.

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T002 [P] [US1] Create `tests/core/rotation/random-pick.test.ts` for
  `pickRandom(currentId: string | null, selection: Selection, random: () => number): string | null`
  from `src/core/rotation/random-pick.ts`. Build photos with the `photo()` helper from
  `tests/support/state.ts`.
  - **Scripted picks**: with saved `['a', 'b', 'c']` and `currentId = 'b'`, `random = () => 0`
    gives `'a'`, and `random = () => 0.99` gives `'c'`, so the candidates are `['a', 'c']`.
  - **Never the current photo** (FR-002, SC-001): with saved `['a', 'b', 'c', 'd']`, 1,000
    chained picks with `seededRandom(1)`, each passing the previous result as `currentId`, never
    pick the same ID twice in a row.
  - **Fair** (SC-002): in the same run of 1,000 picks, each of the 4 IDs is picked between 188
    and 312 times (250 ± 25%). Repeat with `seededRandom(99)`.
  - **No cycle** (SC-003, FR-004): with saved `['a', 'b', 'c']`, in 50 chained picks with
    `seededRandom(7)`, at least one ID repeats before all 3 have appeared since the last time
    that ID was shown.
  - **Single photo** (FR-003): with only `['a']` saved and `currentId = 'a'`, the result is
    `'a'`.
  - **Only saved photos** (FR-005): with `a` pending, `b` unavailable and `c` saved, the result
    is `'c'`, even when `currentId = 'c'`, because only one photo is saved.
  - **Nothing saved**: `null`.
  - **Current photo removed**: when `currentId` is not in the selection, every saved photo is a
    candidate. With saved `['a', 'b']`, `currentId = 'z'` and `random = () => 0`, the result is
    `'a'`.
- [X] T003 [P] [US1] Edit `tests/core/persistence/state-file.test.ts`:
  - **Defaults**: the `defaults match the data model` test expects
    `s.rotation` to deep-equal `{ mode: 'stopped', currentPhotoId: null, nextChangeAt: null }`,
    with no `shownThisRound`.
  - **Round-trip**: the round-trip test uses
    `s.rotation = { mode: 'running', currentPhotoId: 'p1', nextChangeAt: 99 }`.
  - **Old saved state**: add `loadState drops a saved shownThisRound from feature 001`. Write
    `state.json` containing a rotation of `{"mode":"running","currentPhotoId":"p1","shownThisRound":["p1"],"nextChangeAt":5}`.
    After `loadState`, `rotation` must deep-equal
    `{ mode: 'running', currentPhotoId: 'p1', nextChangeAt: 5 }`, and `saveState` must not write
    `shownThisRound`.
- [X] T004 [P] [US1] Edit `tests/core/rotation/engine.test.ts`:
  - **Rotation literals**: remove `shownThisRound` from every `s.rotation = {…}` / `st.rotation = {…}`
    literal in the `restore …` tests.
  - **Stop test**: `stop clears the rotation` expects
    `{ mode: 'stopped', currentPhotoId: null, nextChangeAt: null }`.
  - **Replace** `selectionChanged drops removed IDs from the round and keeps the rest` with
    `selectionChanged keeps the current photo when it is still selected`. Set
    `currentPhotoId = 'a'`, call `selectionChanged()` with `a` still in the selection, and expect
    `currentPhotoId` to still be `'a'`.
  - **Failed set**: in `a failed wallpaper set keeps the current photo and round …`, rename it to
    `… keeps the current photo and retries next interval`, and delete the `shownThisRound`
    assertion.
  - **Add** `next never repeats the photo on screen`: with 3 photos, `start()`, then call `next()`
    30 times. Each `desktop.calls[i]` differs from `desktop.calls[i-1]`.
  - **Add** `with 2 photos, changes alternate`: `start()` followed by 4 `next()` calls alternates
    between the two paths.
- [X] T005 [P] [US1] Edit `tests/core/menu/menu-model.test.ts`: in the `status line shows the next
  change time …` test, remove `shownThisRound: ['a']` from the rotation literal.

### Implementation for User Story 1

- [X] T006 [US1] Create `src/core/rotation/random-pick.ts`, following research R1 and the
  data-model rule "Choosing the next photo":
  - **Candidates**: `selection.photos.filter(p => p.status === 'saved').map(p => p.id)`.
  - **Exclude the current photo**: if there are 2 or more candidates, remove `currentId`.
  - **Pick**: return `null` if none remain, else
    `candidates[Math.floor(random() * candidates.length)]`.
  - **Doc comment**: one line referencing feature 002 FR-001 to FR-005.

  Makes T002 pass.
- [X] T007 [US1] Remove the round state from the data model and saved-state loading:
  - **`src/core/persistence/app-state.ts`**: remove the `shownThisRound` field and its comment
    from `RotationState`, and from `defaultState()`.
  - **`src/core/persistence/state-file.ts`**: build `rotation` from the known keys only:
    `{ mode: parsed.rotation?.mode ?? d.rotation.mode, currentPhotoId: parsed.rotation?.currentPhotoId ?? d.rotation.currentPhotoId, nextChangeAt: parsed.rotation?.nextChangeAt ?? d.rotation.nextChangeAt }`.
    A `shownThisRound` saved by feature 001 is then dropped.

  Makes T003 pass.
- [X] T008 [US1] Update `src/core/rotation/engine.ts`:
  - **Picking**: replace `import { pickNext } from './shuffle.ts'` with
    `import { pickRandom } from './random-pick.ts'`. In `changePhoto`, call
    `pickRandom(state.rotation.currentPhotoId, state.selection, deps.random)` and use its ID
    result directly. Remove `state.rotation.shownThisRound = next.shownThisRound`.
  - **`stop()`**: set `state.rotation = { mode: 'stopped', currentPhotoId: null, nextChangeAt: null }`.
  - **`selectionChanged()`**: keep only the `currentPhotoId` clearing, and update its doc
    comment.
  - **Delete** `src/core/rotation/shuffle.ts` and `tests/core/rotation/shuffle.test.ts`.

  Makes T004 and T005 pass, and keeps every other engine, external-change, unavailable and
  selection-session test passing.
- [X] T009 [US1] Verify US1:
  - `grep -rn "shownThisRound\|pickNext\|shuffle.ts" src tests` prints nothing
  - `npm test`, `npm run typecheck` and `npm run build` all pass

**Checkpoint**: Random picking is live, and the round state is gone.

---

## Phase 4: User Story 2 - The screensaver follows the random pick (Priority: P2)

**Goal**: The screensaver keeps showing the wallpaper photo, now chosen at random.

**Independent Test**: Quickstart scenario 6.

- [X] T010 [US2] Confirm that the existing tests
  `with useForScreensaver on, every photo change is published to the screensaver` and
  `setUseForScreensaver(true) publishes the current photo …` in
  `tests/core/rotation/engine.test.ts` still pass after T008 unchanged. They assert that the
  published ID is `currentPhotoId`, whichever way it was picked. No code change is expected; if
  one fails, fix `src/core/rotation/engine.ts`, not the test.
- [ ] T011 [US2] Manual check (needs a person): quickstart scenario 6. With "Use for screensaver"
  on, start the screensaver and wait for a random change, which should show within 2 s. Record
  the result in `specs/002-random-photo-picks/quickstart.md`.

**Checkpoint**: US1 and US2 are done.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T012 [P] Mark the superseded requirements in feature 001 (spec FR-007):
  - **`specs/001-photos-wallpaper-rotation/spec.md`**:
    - US1 acceptance scenario 9 ("a new round begins…")
    - FR-014
    - SC-006
    - the "Shuffle only" assumption
    - the "Rotation State" key entity ("photos already shown in this round")
    - US3 scenario 4 ("without restarting the round …")

    Prefix each with **"Superseded by feature 002 (fully random picks):"**, followed by a
    one-line replacement, for example "each change picks a random saved photo, never the one on
    screen". Keep the original text struck through with `~~…~~`.
  - **`specs/001-photos-wallpaper-rotation/data-model.md`**: at the top of "Choosing the next
    photo", add a note pointing to `specs/002-random-photo-picks/data-model.md`, and strike
    through the `shownThisRound` row.
- [X] T013 [P] Update `README.md`, which currently says "Photos are shuffled with no repeats
  within a round". Replace it with "Each change shows a random photo from your selection (never
  the one already on screen)".
- [ ] T014 Manual check (needs a person): quickstart scenarios 1–5 (no repeats, no cycle, single
  photo, two photos alternate, old `state.json` migrates). Record the results in
  `specs/002-random-photo-picks/quickstart.md`.

---

## Dependencies & Execution Order

- **T001** comes first.
- **T002–T005** are all [P], each in a different test file. Write them all and confirm they fail.
- **T006** needs T002. **T007** needs T003.
- **T008** needs T004, T005, T006 and T007, because the engine imports both of them.
- **T009** needs T008.
- **US2** (T010–T011) needs T008.
- **Polish**: T012 and T013 are [P], and can run any time after T008. T014 is last.

### Parallel Example: User Story 1

```bash
Task: "T002 random-pick tests in tests/core/rotation/random-pick.test.ts"
Task: "T003 state-file tests in tests/core/persistence/state-file.test.ts"
Task: "T004 engine tests in tests/core/rotation/engine.test.ts"
Task: "T005 menu-model fixture in tests/core/menu/menu-model.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001: record the baseline.
2. T002–T005: write the tests and watch them fail.
3. T006–T008: implement until the suite is green.
4. T009: verify. Random picking then ships with nothing else needed.

### Incremental Delivery

1. US1 (the MVP).
2. US2, a confirmation only.
3. Polish: feature 001's docs, the README, and the manual checks.

---

## Notes

- This feature removes code: `shuffle.ts`, the round state, and its migration risk is handled by
  T007.
- There are no new dependencies and no Electron or native changes.
- Commit after each green step.
