# Research: Remove the screensaver

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-01

## R1. Inventory (from the code, 2026-11-01)

| Area | Where | What goes |
|------|-------|-----------|
| Menu | `src/core/menu/menu-model.ts:43` | The `toggleScreensaver` toggle "Use for screensaver" |
| Settings | `src/core/persistence/app-state.ts` | `RotationSettings.useForScreensaver`, its default, and the screensaver words in the `Power` comment |
| Engine | `src/core/rotation/engine.ts` | The `handoff?: Handoff` dependency, `publishToScreensaver` (called after each shown photo), `setUseForScreensaver`, the `turnOff` handoff branch, and screensaver words in comments |
| Sign-out | `src/core/auth/sign-out.ts` | The `handoff?: Handoff` parameter, `handoff.disable()`, and "(including the screensaver's)" in the doc comment |
| Core module | `src/core/screensaver/` | `handoff.ts`, `installer.ts` (with `SCREEN_SAVER_SETTINGS_URL`), `uninstall.ts` |
| Main process | `src/main/main.ts` | The imports, `createHandoffWriter`, `installAndGuideSaver`, the `toggleScreensaver` handler, the Turn off screensaver branch and its dialog, the Turn on reinstall, and `handoff` in `signOut(...)` |
| Native | `native/saver/` | `GlimpseSaverView.swift` and `Info.plist` |
| Build | `scripts/build-native.sh` (`build_saver`, header comment), `forge.config.js` (`extraResource` `build/Glimpse.saver`) | The screensaver build and packaging |
| Package check | `scripts/check-package.sh` | `Glimpse.saver` moves from "must be bundled" to "must not be bundled" |
| Package metadata | `package.json` `description` | Becomes "Rotate your macOS wallpaper through photos you choose from Google Photos." |
| Docs | `README.md` (lines 3, 15, 71, 89, 111, 141–142), `PRIVACY.md` (10, 32, 48, 73–75, 79–80), `TERMS.md` (16) | The screensaver descriptions |

**Unaffected**:
- The CI workflow (no screensaver steps).
- `glimpse-helper` and the wallpaper code.
- The selection window, sign-in and the interval.

## R2. Loading older state files

- **Finding**: `state-file.ts` builds settings as `{ ...d.settings, ...parsed.settings }`. An old
  file's `useForScreensaver: true` would survive the spread, stay in memory, and be written back
  on the next save, even though the type no longer has it.
- **Decision**: build settings from the known keys only:
  `{ intervalMinutes: parsed.settings?.intervalMinutes ?? d…, startAtLogin: parsed.settings?.startAtLogin ?? d… }`.
  The test-first case is a file with `useForScreensaver: true` and `intervalMinutes: 15`. It
  loads with interval 15, keeps `startAtLogin`, and has no `useForScreensaver` key.
- **Alternatives considered**: leaving the spread. That's harmless at runtime, but the removed
  setting keeps living in users' files, which goes against FR-005 ("removed").

## R3. Turn off and Turn on in the main process

- **Today**:
  - Turn off shows a dialog ("…your wallpaper is restored. Your screensaver was reset…" with
    "Open Screen Saver Settings") only when the screensaver was on. For everyone else it shows
    nothing.
  - Turn on reinstalls the screensaver when the setting was on.
- **Decision**:
  - Turn off becomes `windows.close('selection'); await engine.turnOff()`. That's what users
    without the screensaver already got.
  - Turn on becomes `engine.turnOn()`.
- **Rationale**: the dialog existed only to explain the screensaver reset. The menu already
  shows the off state (feature 004).

## R4. Tests: what's removed, what's added, what's kept

| File | Change |
|------|--------|
| `tests/core/screensaver/handoff.test.ts` (4), `installer.test.ts` (2), `uninstall.test.ts` (2) | Delete. The module is gone |
| `tests/core/rotation/engine.test.ts` | Delete the "US2: screensaver handoff" block: `fakeHandoff` and its 3 tests |
| `tests/core/rotation/done-applies.test.ts` | Delete "the screensaver gets the new photo" |
| `tests/core/auth/sign-out.test.ts` | Delete "sign-out turns off the screensaver handoff" |
| `tests/core/menu/menu-model.test.ts` | Delete "the screensaver toggle reflects the setting", and remove the toggle from the expected full menu. **Add first**: "the menu has no screensaver option" (no item with id `toggleScreensaver` and no label containing "screensaver", signed in or off) |
| `tests/core/rotation/power.test.ts` | Keep both tests, minus their screensaver parts. "turnOff restores the originals, stops, and keeps the setup" drops the handoff assertions. "while off, nothing changes the wallpaper" drops `fakeHandoff`. The wallpaper assertions stay |
| `tests/core/persistence/state-file.test.ts` | Change the default-settings expectation to `{ intervalMinutes: 30, startAtLogin: false }`. **Add first**: "a legacy useForScreensaver setting is dropped on load" (R2) |

Expected count: 232 − 8 (screensaver module) − 3 (engine) − 1 (done-applies) − 1 (sign-out)
− 1 (menu) + 1 (menu) + 1 (state-file) = **220**.

## R5. Packaging check

- **Decision**: in `scripts/check-package.sh`:
  - Drop `Glimpse.saver` from the "bundles" loop.
  - Add `check "no screensaver bundled" test ! -e "$app/Contents/Resources/Glimpse.saver"`.

  The CI workflow already runs this script, so CI enforces FR-004.
- **Test-first**: run the updated script on the current package, which still has the
  screensaver. The new check fails. After the build changes, it passes.
- **Contract note**: this updates contract D5 of
  [007's distribution contract](../007-ci-release-builds/contracts/distribution.md), which listed
  `Glimpse.saver` as required. The 007 record isn't edited; this note supersedes it.
