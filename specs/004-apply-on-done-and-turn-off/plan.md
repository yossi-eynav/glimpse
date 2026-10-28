# Implementation Plan: Apply New Photos on Done, and Turn Off

**Branch**: `004-apply-on-done-and-turn-off` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-apply-on-done-and-turn-off/spec.md`, written
during this planning run, with the owner's answers to two scope questions.

## Summary

**1. Done applies new photos at once.**
- `SelectionDraft.commit()` also reports `addedIds`.
- On Done, the engine switches the rotation to running and shows a random photo from those just
  added, which also updates the screensaver. If none has finished downloading, it waits in a
  `pendingShow` set and shows the first one that does.

**2. Turn off and Turn on.**
- A persisted `power: 'on' | 'off'` flag, checked at every engine entry point that can change the
  wallpaper.
- The originals: each display's wallpaper is recorded before the app's first change, and again
  on every Turn on.
- **Turn off**:
  - stops the rotation
  - restores, through a new `pw-helper` `restore` command, only the displays still showing an
    app photo (other Spaces are restored as the user visits them)
  - disables the screensaver handoff and removes our `.saver`, then sends the user to Screen
    Saver settings
  - keeps the sign-in, the selection and the settings
- **Turn on**: records new originals and restarts the rotation.
- **Menu**: a "Turn off" item, and a minimal "Turned off" menu with "Turn on".

## Technical Context

**Language/Version**: TypeScript 7 on Node 24 / Electron 45, and Swift for `pw-helper`. Both
unchanged.

**Primary Dependencies**: None new.

**Storage**: `state.json` gains `power` and `original`. Older files load with `power: 'on'` and
`original: null`.

**Testing**:
- `node:test` with the existing fakes (`FakeDesktop` gains `restore`, plus `ManualClock`,
  `MemoryFileSystem` and a seeded random).
- The fake helper script gains `restore`.
- Manual checks and spikes S1 and S2 cover the macOS side.

**Target Platform**: macOS 14 or later. Unchanged.

**Project Type**: desktop-app. This changes the existing app.

**Performance Goals**:
- A new photo on screen within 5 s of Done, or of its download finishing (SC-001).
- The wallpaper restored within 5 s of Turn off (SC-002).

**Constraints**:
- While off: no wallpaper or screensaver change from any source (FR-011, SC-003).
- Never overwrite a wallpaper the user chose themselves.
- macOS doesn't let apps select a screensaver, so Turn off can only remove ours and guide the
  user (research R3).

**Scale/Scope**:
- **Core**:
  - 1 small new module, `src/core/screensaver/uninstall.ts`, alongside the installer
  - edits to `engine.ts`, `selection-draft.ts`, `selection-session.ts`, `app-state.ts`,
    `state-file.ts`, `menu-model.ts` and `desktop.ts`
- **Helper**: 1 new command, in `native/helper/main.swift`, `helper-protocol.ts` and
  `helper-desktop.ts`.
- **Main process**: 2 menu handlers in `main.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.0) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change | ✅ Tests come first for every behavior: Done showing new photos, `pendingShow`, power guards, the originals, restore, the menus, and the helper `restore` encoding and client. All use the existing fakes (R5) |
| II. Simplicity | No speculative features; dependencies justified | ✅ No new dependencies. One flag (`power`) instead of extra modes. `pendingShow` is kept in memory only. No attempt to automate System Settings (R3) |
| Desktop: lifecycle | Launch, background, offline, quit or restart | ✅ `power` survives restarts (FR-013). Launch, wake and display events are guarded while off. The helper restore is retried after a helper restart |
| Desktop: responsive UI | No blocking | ✅ The restore is an async helper request. The messages are non-blocking |
| Desktop: credentials | OS secure store | ✅ Not affected. Turn off keeps the sign-in |
| Desktop: stack recorded | — | ✅ Unchanged |

**Pre-design gate**: PASS. **Post-design re-check**: PASS. There's no new complexity beyond one
helper command and one persisted flag.

## Project Structure

### Documentation (this feature)

```text
specs/004-apply-on-done-and-turn-off/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── wallpaper-helper-restore.md
│   └── menu-power.md
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
src/core/
├── persistence/app-state.ts       # + power, original; defaultState()
├── persistence/state-file.ts      # load power and original (defaults for older files)
├── library/selection-draft.ts     # commit() also returns addedIds
├── library/selection-session.ts   # commit → onSelectionCommitted({addedIds}); download updates → engine.photoStatusChanged
├── rotation/engine.ts             # selectionChanged({addedIds}), photoStatusChanged, pendingShow, recordOriginals, turnOff, turnOn, power guards
├── wallpaper/desktop.ts           # Desktop.restore?(paths); FakeDesktop.restore
├── wallpaper/helper-protocol.ts   # + {cmd:'restore', paths} request; restored count in the response
├── screensaver/uninstall.ts       # NEW: uninstallSaver({fs, home})
└── menu/menu-model.ts             # turnOff item; the off menu; power-aware notices
src/main/
├── platform/helper-desktop.ts     # restore(paths); re-send restore after a restart while off
└── main.ts                        # turnOff and turnOn handlers, screensaver messages, onSelectionCommitted({addedIds})
native/helper/main.swift           # restore command; restoreTargets re-applied on Space and display changes
tests/
├── core/rotation/done-applies.test.ts    # NEW
├── core/rotation/power.test.ts           # NEW
├── core/library/selection-draft.test.ts  # addedIds
├── core/library/selection-session.test.ts
├── core/persistence/state-file.test.ts   # power and original defaults and round-trip
├── core/menu/menu-model.test.ts          # turnOff item, off menu
├── core/screensaver/uninstall.test.ts    # NEW
├── core/wallpaper/helper-protocol.test.ts
├── main/helper-desktop.test.ts
└── support/fake-helper.mjs               # + restore
```

**Structure Decision**: the same single project. All the decisions are in `src/core`. The helper
gains one command, and the main process gains two handlers.

## Complexity Tracking

No constitution violations. One new persisted flag and one new helper command, both needed by
FR-008 and FR-011.
