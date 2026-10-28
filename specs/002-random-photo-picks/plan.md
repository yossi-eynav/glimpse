# Implementation Plan: Fully Random Photo Picks

**Branch**: `002-random-photo-picks` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-random-photo-picks/spec.md`

## Summary

Each wallpaper change now picks a photo uniformly at random from the available photos,
excluding the one on screen when there are 2 or more. This replaces feature 001's shuffled
rounds. Concretely:
- **Replaced**: `pickNext` (shuffle per round) becomes `pickRandom` in
  `src/core/rotation/random-pick.ts`.
- **Removed**: the round state (`RotationState.shownThisRound`).
- **Engine**: its call sites are simplified.
- **Saved state**: rounds saved by feature 001 are ignored when `state.json` loads.

The engine's timing, the helper, the screensaver and the UI are all unchanged. The work is
core-only, test-first, and has no new dependencies.

## Technical Context

**Language/Version**: TypeScript 7 (erasable syntax) on Node.js 24 / Electron 45. This is
unchanged from feature 001.

**Primary Dependencies**: None new. The injected `random: () => number` (`Math.random` in
production) is kept (research R2).

**Storage**: `state.json`. The `rotation` object loses `shownThisRound`, and old values are
dropped on load (research R3).

**Testing**: `node:test` with the seeded `seededRandom()`. The statistical criteria SC-001 to
SC-003 become deterministic tests (research R4).

**Target Platform**: macOS 14 or later. Unchanged.

**Project Type**: desktop-app. This is a change to the existing app in feature 001.

**Performance Goals**: Picking is O(n) over at most about 2,000 photos per change, which is
negligible. Feature 001's SC-003 and SC-007 timing is unchanged (spec SC-004).

**Constraints**: There's no new state, no new UI, and no new IPC. Feature 001's handling of
unavailable photos (FR-024) and its blocked mode still apply.

**Scale/Scope**:
- **Production**: 1 new module, 1 module deleted, and 3 modules edited (`app-state.ts`,
  `state-file.ts`, `engine.ts`).
- **Tests**: 1 test file replaced and 3 edited.
- **Docs**: feature 001's docs updated (spec FR-007).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.0) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change | ✅ `random-pick.test.ts` and the updated engine and state-file tests are written first and seen failing. Randomness is tested deterministically with a seeded generator (R4) |
| II. Simplicity | Only current requirements; no speculative features | ✅ This removes state (`shownThisRound`) and logic (rounds). There is no setting, no weighting, and no new dependency (spec Assumptions; research R1 and R2) |
| Desktop: lifecycle | Launch, background, offline, quit or restart | ✅ Old saved state loads cleanly (R3). Catch-up after launch or wake uses the same rule |
| Desktop: responsive UI | No blocking on the UI thread | ✅ An O(n) pick in the main process |
| Desktop: credentials | Kept in the OS secure store | ✅ Not affected |
| Desktop: stack recorded | Stack, OS and packaging | ✅ Unchanged from feature 001 |

**Pre-design gate**: PASS. **Post-design re-check**: PASS. The design only removes things or
narrows behavior.

## Project Structure

### Documentation (this feature)

```text
specs/002-random-photo-picks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

There is no `contracts/`. The feature changes no interface the app exposes: the IPC, the menu,
the helper protocol and the screensaver handoff are all unchanged.

### Source Code (repository root)

```text
src/core/rotation/
├── random-pick.ts       # NEW: pickRandom(currentId, selection, random) → string | null
├── shuffle.ts           # DELETED (pickNext and its rounds)
└── engine.ts            # EDIT: use pickRandom; drop shownThisRound from changePhoto, stop, selectionChanged
src/core/persistence/
├── app-state.ts         # EDIT: RotationState without shownThisRound; defaultState()
└── state-file.ts        # EDIT: build rotation from known keys only (drops a saved shownThisRound)

tests/core/rotation/
├── random-pick.test.ts  # NEW: replaces shuffle.test.ts
├── shuffle.test.ts      # DELETED
└── engine.test.ts       # EDIT: no shownThisRound; selectionChanged keeps/clears currentPhotoId
tests/core/persistence/state-file.test.ts   # EDIT: defaults; old shownThisRound ignored
tests/core/menu/menu-model.test.ts          # EDIT: fixture rotation objects lose shownThisRound

specs/001-photos-wallpaper-rotation/        # EDIT (spec FR-007): FR-014 and SC-006 marked superseded; data-model note
```

**Structure Decision**: the same single npm project as feature 001. All of this feature's
changes are in `src/core`, with nothing in the Electron or native layers.

## Complexity Tracking

No constitution deviations. This feature reduces complexity.
