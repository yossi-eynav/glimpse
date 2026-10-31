# Implementation Plan: Remove the screensaver

**Branch**: `008-remove-screensaver` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-remove-screensaver/spec.md`

## Summary

This feature deletes the screensaver feature end to end:
- **Menu**: the "Use for screensaver" toggle and its handler.
- **Settings**: the `useForScreensaver` setting. A saved state file that still has it loads,
  and the key is dropped.
- **Engine**: `publishToScreensaver`, `setUseForScreensaver`, and the handoff calls in
  `turnOff`.
- **Sign-out**: the `handoff` parameter.
- **Core code**: the whole `src/core/screensaver/` module (handoff, installer, uninstall).
- **Main process**: the install and guide dialog and the Turn off and Turn on screensaver
  branches.
- **Native**: the screensaver (`native/saver/`) and its build and packaging.
- **Docs**: the screensaver parts of the README, PRIVACY.md and TERMS.md.

Per the clarification, there is no clean-up code for old screensaver files. Turn off no longer
shows a dialog. The old one only explained the screensaver reset, and users who never used
the screensaver never saw it.

## Technical Context

**Language/Version**: unchanged. TypeScript 7 on Node 24.22 and Electron 45, with Swift for
`glimpse-helper` only.

**Primary Dependencies**: none added or removed.

**Storage**: `state.json` `settings` loses `useForScreensaver`. Loading keeps only the known
settings keys (R2).

**Testing**:
- `node:test`. New failing tests come first: the menu has no screensaver toggle, and a legacy
  `useForScreensaver` is dropped on load.
- Screensaver-only tests are deleted, 8 in `tests/core/screensaver/` plus others in the engine,
  sign-out, menu, done-applies and power tests. Mixed tests are trimmed to their wallpaper part.
- `scripts/check-package.sh` asserts the package contains **no** `Glimpse.saver`.

**Target Platform**: macOS 14 or later, unchanged.

**Project Type**: desktop app (Electron, plus a Swift helper).

**Performance Goals**: N/A.

**Constraints**:
- Old state files must load (FR-005).
- Leftover screensaver files aren't touched (FR-008).
- Wallpaper behavior is unchanged (FR-006).

**Scale/Scope**:
- Remove 8 files: 3 core, 2 native, 3 tests.
- Edit about 20 files.
- The test count goes from 232 to about 220. R4 lists every test removed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.1) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change | ✅ The new behaviors get failing tests first: no screensaver toggle in the menu, and a legacy setting dropped on load. The package check flips to "no `Glimpse.saver`" and fails before the build change. Deleting tests for deleted behavior is part of removing that behavior, and R4 lists each one so no wallpaper coverage is lost |
| II. Simplicity | No speculative work | ✅ This is a pure removal. No clean-up or migration code, per the clarification. The settings loader picks known keys, which is the smallest fix that actually drops the old key |
| Desktop: credentials | OS secure store | ✅ Unchanged |
| Desktop: packaging | Plan states stack and packaging | ✅ The same Forge universal build, now with one native piece instead of two |

**Pre-design gate**: PASS. **Post-design re-check**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/008-remove-screensaver/
├── spec.md
├── plan.md
├── research.md              # R1–R5
├── data-model.md            # settings change, state-file compatibility
├── contracts/menu-and-package.md  # menu items, Turn off/on behavior, package contents after removal
├── quickstart.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
DELETE  src/core/screensaver/{handoff,installer,uninstall}.ts
DELETE  tests/core/screensaver/{handoff,installer,uninstall}.test.ts
DELETE  native/saver/{GlimpseSaverView.swift,Info.plist}
EDIT    src/core/persistence/app-state.ts      # drop useForScreensaver; comment
EDIT    src/core/persistence/state-file.ts     # settings: pick intervalMinutes, startAtLogin only
EDIT    src/core/rotation/engine.ts            # drop handoff dep, publishToScreensaver, setUseForScreensaver, turnOff branch
EDIT    src/core/auth/sign-out.ts              # drop handoff param
EDIT    src/core/menu/menu-model.ts            # drop the toggle
EDIT    src/main/main.ts                       # drop handoff, installAndGuideSaver, toggleScreensaver, Turn off dialog, Turn on install
EDIT    scripts/build-native.sh, forge.config.js, scripts/check-package.sh
EDIT    tests/core/{menu/menu-model,persistence/state-file,auth/sign-out}.test.ts
EDIT    tests/core/rotation/{engine,done-applies,power}.test.ts
EDIT    README.md, PRIVACY.md, TERMS.md
```

**Structure Decision**: removal only. There are no new modules.

## Complexity Tracking

No constitution violations.
