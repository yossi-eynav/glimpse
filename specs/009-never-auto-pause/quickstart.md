# Quickstart & Validation: Glimpse never pauses on its own

## Automated checks

1. **Red first** (research R4). These fail before the code changes:
   - the new tests in `tests/core/rotation/external-change.test.ts`;
   - the legacy-mode test in `tests/core/persistence/state-file.test.ts`;
   - the logging test in `tests/main/helper-desktop.test.ts`.
2. **Tests and types**: `npm test` passes about 219 tests, and `npm run typecheck` is clean.
3. **No automatic pause left**. The only allowed matches are the migration line in
   `src/core/persistence/state-file.ts` and its regression tests in `state-file.test.ts` and
   `external-change.test.ts`:

   ```sh
   grep -rnI "pausedExternalChange\|changedOutsideApp\|onExternalChange\|engine.externalChange\|changed in System Settings" \
     src tests README.md
   ```

   `externalChange` itself still appears in the helper protocol, the helper client log, the
   fake helper and their tests (contract N3).
4. **Helper untouched**: `git diff --stat native/` is empty.

## Manual validation

| # | Check | Expected |
|---|-------|----------|
| 5 | `npm start`, set the interval to 1 minute, then set a wallpaper in System Settings | The menu still shows "Next change …". Within a minute, a Glimpse photo replaces it on every display (N1, N2) |
| 6 | Set a wallpaper in System Settings, then switch Spaces before the next change | Your wallpaper isn't immediately replaced (N3, FR-005) |
| 7 | Pause, set a wallpaper in System Settings, wait past the interval | Nothing changes. Resume restarts rotation |
| 8 | Quit. Edit `state.json` so `rotation.mode` is `"pausedExternalChange"` and `nextChangeAt` is `null`, then launch | A photo is shown at launch, the menu shows "Next change …", and after the next save `state.json` says `"running"` (FR-006) |
| 9 | Read README.md | It says your own wallpaper stays until the next change, not that rotation pauses |

## Recorded results

- **2026-11-13, T001 (baseline)**:
  - `npm test` passed 220 and `typecheck` was clean.
  - The step 3 grep matched 26 lines.
- **2026-11-13, T004 (red)**: 3 tests failed:
  - "a wallpaper set outside the app doesn't stop the next scheduled change (FR-001)";
  - "with one of two screens changed, the next change sets every screen (FR-002)";
  - "externalChange events are logged and change nothing".

  All 3 passed after T005–T007, with 215/215.
- **2026-11-13, T009 (guard)**: "while paused by the user, a manual wallpaper and a due tick
  change nothing" passed straight away, as expected (216/216).
- **2026-11-13, T010**: the engine sets non-running modes only in:
  - `pause()` (`'paused'`);
  - `changePhoto` (`'blockedNoPhotos'`);
  - the `'stopped'` resets in `stop` and `turnOff`.
- **2026-11-13, T013 (red)**: 2 tests failed, and both passed after T014:
  - "a legacy pausedExternalChange mode loads as running";
  - "a legacy auto-paused state shows a photo at launch and schedules the next change (FR-006)".
- **2026-11-13, T017 (green)**:
  - `npm test` passed **219/219**, exactly the R4 prediction.
  - `npm run typecheck` is clean.
  - The step 3 grep matches only the allowed lines.
  - `git diff --stat native/` is empty.
