# Implementation Plan: Glimpse never pauses on its own

**Branch**: `009-never-auto-pause` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-never-auto-pause/spec.md`

## Summary

Remove the automatic pause. Today two paths pause rotation when the user sets a wallpaper
outside Glimpse:
- the engine's check before each scheduled change (`changedOutsideApp`);
- the helper's `externalChange` event, which calls `engine.externalChange()`.

Both lead to the `pausedExternalChange` mode. This feature removes that mode, the check, the
engine method and the app's subscription to the event. The scheduled change then always shows a
new photo.

`glimpse-helper` is **not changed**. Its latch (it stops re-applying on Space changes after a
manual change, until the next `show`) is exactly what FR-005 needs: the user's wallpaper stays
until the next change. The helper keeps sending `externalChange`. The app logs it and does
nothing else (research R2).

Old state files saved in `pausedExternalChange` load as `running` with no scheduled change, so
the existing launch logic shows a photo at once (research R3).

## Technical Context

**Language/Version**: TypeScript 7 (erasable syntax) on Node 24.22 / Electron 45; Swift helper
unchanged

**Primary Dependencies**: none added or removed

**Storage**: `state.json` in `~/Library/Application Support/Glimpse/`. One value is migrated on
load (data-model.md)

**Testing**: `node --test` (`npm test`), `npm run typecheck`. The helper is exercised through
`tests/support/fake-helper.mjs`

**Target Platform**: macOS 14 (Sonoma) or later, universal (arm64 + x86_64)

**Project Type**: desktop app (menu bar)

**Performance Goals**: n/a. This removes work: one fewer wallpaper read per scheduled change

**Constraints**: offline tests only; the helper wire protocol stays at version 1

**Scale/Scope**: about 6 source files and 6 test files, plus the README

**Desktop stack, OS, packaging** (Constitution): unchanged from feature 007. Electron 45,
macOS 14+, Electron Forge universal zip and dmg, ad-hoc signed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status |
|------|--------|
| **I. Test-First** | Pass. The new and changed behavior tests are written and seen failing first: the scheduled change after a manual wallpaper (engine), the legacy-mode migration (state file), and the helper event being logged (platform). Tests of the removed behavior are rewritten or deleted with it (research R4). The README change is docs only |
| **II. Simplicity** | Pass. Pure removal plus a one-line migration. No new setting, mode or protocol change. The helper and its latch are reused as is rather than redesigned |
| **Desktop constraints** | Pass. No change to the lifecycle, threading, credentials or packaging |

**Post-design re-check**: still passes. The design adds no abstraction. The only new code is
the migration line and the log line.

## Project Structure

### Documentation (this feature)

```text
specs/009-never-auto-pause/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rotation-and-menu.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/core/
├── persistence/app-state.ts      # RotationMode loses 'pausedExternalChange'
├── persistence/state-file.ts     # legacy mode → 'running' on load
├── rotation/engine.ts            # remove changedOutsideApp, externalChange()
├── menu/menu-model.ts            # remove the mode's Resume item and status line
└── wallpaper/desktop.ts          # remove Desktop.onExternalChange
src/main/
├── main.ts                       # remove the onExternalChange subscription
└── platform/helper-desktop.ts    # log externalChange; drop the listener set
native/helper/main.swift          # unchanged
tests/core/rotation/external-change.test.ts   # rewritten for the new behavior
tests/core/rotation/done-applies.test.ts      # drop the pausedExternalChange case
tests/core/menu/menu-model.test.ts            # drop the mode's assertions
tests/core/persistence/state-file.test.ts     # add the migration tests
tests/main/helper-desktop.test.ts             # event is logged, not delivered
README.md                                     # rotation bullet
```

**Structure Decision**: existing single-project layout. Behavior stays in `src/core/`; the
Electron layer only loses one line of wiring.

## Complexity Tracking

None.
