# Quickstart & Validation: Remove the screensaver

## Automated checks

1. **Red first**:
   - The new menu test ("no screensaver option") and state-file test ("legacy
     useForScreensaver dropped") fail before the code changes.
   - `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app` fails the new "no
     screensaver bundled" check on the current package.
2. **Tests and types**: `npm test` passes, with about 220 tests (R4), and `npm run typecheck`
   is clean.
3. **No screensaver left in live files**. The only allowed matches are the two regression tests
   from step 1 and the package check, which assert the screensaver is gone:
   `tests/core/menu/menu-model.test.ts`, `scripts/check-package.sh` and
   `tests/core/persistence/state-file.test.ts`.

   ```sh
   grep -rnIiE "screensaver|screen saver|\bsaver\b|handoff|Glimpse\.saver" \
     --exclude-dir={node_modules,.git,dist,build,out,specs,.claude} .
   ```

4. **Package** (FR-004): `npm run build:native` produces only `build/glimpse-helper`. After
   `npm run make`, `scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app` passes,
   including "no screensaver bundled".

## Manual validation

| # | Check | Expected |
|---|-------|----------|
| 5 | `npm start`, then open the menu while signed in | It matches contract M1: no "Use for screensaver" |
| 6 | Turn off, then Turn on | The wallpaper is restored, no dialog appears, and the menu shows off. Turn on resumes rotation (M2) |
| 7 | Start with a `state.json` from the previous build that has `"useForScreensaver": true` | The app starts with the saved interval and settings. After the next save, `state.json` has no `useForScreensaver` (SC-004) |
| 8 | On a Mac with the old `~/Library/Screen Savers/Glimpse.saver`, launch the new build | The old bundle and its photo copy are unchanged (FR-008) |
| 9 | Read PRIVACY.md, TERMS.md and README.md | No screensaver feature is described. PRIVACY.md has a new "Last updated" date (FR-007) |

## Recorded results

- **2026-11-01, T003 (red)**: after the menu test changes, 2 tests failed: "signed in shows
  every item in contract order" and "the menu has no screensaver option". They passed after
  T004.
- **2026-11-01, T009 (red)**:
  - `npm test` failed "a legacy useForScreensaver setting is dropped on load" and "defaults
    match the data model".
  - `scripts/check-package.sh` on the previous package printed `FAIL no screensaver bundled`
    and exited 1.
- **2026-11-01, T019 (green)**:
  - `npm test` passed **220/220**, exactly the R4 prediction (232 − 14 + 2).
  - `npm run typecheck` is clean.
  - The quickstart step 3 grep matches only the allowed lines, in `menu-model.test.ts`,
    `state-file.test.ts` and `check-package.sh`.
  - `npm run build:native` produces only `build/glimpse-helper`.
  - `npm run make` printed "Ad-hoc signed …" and built the zip and dmg.
  - `check-package.sh` passes all 6 checks, including `ok no screensaver bundled`.
- **2026-11-01, T020**: `grep -rnI "Screen Savers\|legacyScreenSaver\|Glimpse.saver" src scripts
  forge.config.js` matches only the package check's "must not be bundled" line. No code can
  read, change or delete old screensaver files.
