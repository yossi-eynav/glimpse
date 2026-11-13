# Research: Glimpse never pauses on its own

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-13

## R1. Inventory (from the code, 2026-11-13)

| Area | Where | What changes |
|------|-------|--------------|
| State type | `src/core/persistence/app-state.ts` | `RotationMode` loses `'pausedExternalChange'` |
| Engine, check at the scheduled change | `src/core/rotation/engine.ts` `changedOutsideApp` and its use in `tick()` | Removed. `tick()` always changes the photo when due |
| Engine, helper event | `engine.ts` `externalChange()` | Removed |
| Engine, resume | `engine.ts` `resume()` | Only resumes from `'paused'` |
| Menu | `src/core/menu/menu-model.ts` `startItem`, `statusLine` | The `pausedExternalChange` cases go. "Paused — wallpaper changed in System Settings" disappears |
| Wiring | `src/main/main.ts` `desktop.onExternalChange(() => void engine.externalChange())` | Removed |
| Desktop interface | `src/core/wallpaper/desktop.ts` `onExternalChange?` | Removed; nothing subscribes any more |
| Helper client | `src/main/platform/helper-desktop.ts` `externalListeners`, `onExternalChange` | Removed. The event is logged at info level (R2) |
| Helper | `native/helper/main.swift` | **Unchanged** (R2) |
| Wire protocol | `src/core/wallpaper/helper-protocol.ts` | **Unchanged**: still parses `externalChange`, version stays 1 |
| Docs | `README.md` lines 13–14 | "If you pick a wallpaper yourself…, it stays until the next change." |

PRIVACY.md and TERMS.md don't mention the pause.

## R2. Keep the helper's latch, ignore its event

- **Finding**: after a manual change, `glimpse-helper` sets `latched = true`, sends
  `externalChange`, and stops re-applying the current photo on Space and display changes. The
  next `show` clears the latch. That is exactly FR-005: the user's wallpaper stays until the
  next change.
- **Decision**: leave the helper and the protocol as they are. In `helper-desktop.ts`, log the
  event (`'info'`, "the wallpaper was changed outside Glimpse; it stays until the next
  change") instead of delivering it to listeners.
- **Rationale**: no Swift rebuild or protocol version bump, and FR-005 keeps working without
  new code.
- **Alternatives considered**:
  - *Remove the store watcher and latch from the helper*: then a Space switch would put the
    Glimpse photo straight back over the user's choice, which breaks FR-005. It would also
    change the protocol.
  - *Keep `onExternalChange` with no subscriber*: dead code (Principle II).

## R3. Migrating saved state

- **Finding**: in `pausedExternalChange`, the engine already saved `nextChangeAt = null`. On
  launch, `engine.restore()` makes an immediate change when the mode is `running` and
  `nextChangeAt` is null, then schedules the next one.
- **Decision**: in `loadState`, map a saved mode of `'pausedExternalChange'` to `'running'`.
  Keep `nextChangeAt` as saved (null). The existing launch logic then shows a photo and
  schedules the next change one interval later. A saved `'paused'` is untouched.
- **Rationale**: one line, reusing tested launch behavior. The user never chose to pause, so
  resuming at once matches the spec (FR-006, SC-004). The spec was aligned with this during
  planning.
- **Alternatives considered**: scheduling the first change one interval after launch. That
  needs a clock in `loadState`, or a special case in `restore()`, for no user benefit.

## R4. Tests

| File | Change |
|------|--------|
| `tests/core/rotation/external-change.test.ts` (7 tests) | Rewritten as 5 tests. **First, red**: (1) a wallpaper set outside the app doesn't stop the next scheduled change: mode stays `running` and a photo is set; (2) with one of two screens changed, the next change sets the Glimpse photo on every screen; (3) while paused by the user, a manual change and a due tick change nothing; (4) a legacy `pausedExternalChange` state, loaded and restored, shows a photo at launch and schedules the next change. Kept: (5) "paths inside the app's Photos folder" becomes the plain "the next change still happens" control. The two prefix tests and the 3 `externalChange()` tests are deleted with the method |
| `tests/core/rotation/done-applies.test.ts` | Delete the `pausedExternalChange` case of "from …, Done shows a new photo" (1 test) |
| `tests/core/menu/menu-model.test.ts` | Remove the `pausedExternalChange` assertions from the start-item and status-line tests (no test count change) |
| `tests/core/persistence/state-file.test.ts` | **Add first, red**: "a legacy pausedExternalChange mode loads as running" and "a saved paused mode stays paused" (+2) |
| `tests/main/helper-desktop.test.ts` | Replace "externalChange events are delivered to subscribers" with "externalChange events are logged and change nothing" (red first: no info log today) |

Expected count: 220 − 7 + 5 − 1 + 2 = **219**.

## R5. Contract records

The 001 contracts describe the old behavior:
- `wallpaper-helper.md` rule 5 ("Engine reaction")
- `menu-ui.md` rows for `pausedExternalChange`

As in feature 008, the earlier records aren't edited.
[contracts/rotation-and-menu.md](./contracts/rotation-and-menu.md) supersedes those parts.
