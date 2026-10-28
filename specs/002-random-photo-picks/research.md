# Research: Fully Random Photo Picks

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-27

There were no unknowns in the Technical Context. These are the design decisions.

## R1. The picking rule

- **Decision**: `pickRandom(current, selection, random)`:
  1. **Candidates**: the photos with `status === 'saved'`. When there are 2 or more, also drop
     `current`.
  2. **None left**: return `null`.
  3. **Otherwise**: return `candidates[Math.floor(random() * candidates.length)]`.

  There is no round state and no history (FR-001 to FR-005).
- **Rationale**: This is the smallest rule that meets the spec. It is uniform over the candidates
  (SC-002), never repeats the photo on screen (SC-001), and has no cycle (SC-003).
- **Alternatives considered**:
  - **Keep the shuffled rounds and add randomness some other way**: the owner chose fully random
    picks instead (spec, "Clarified intent").
  - **Exclude the last k photos, a "short memory"**: it would need history, which FR-004 rules
    out. The spec's assumptions accept short-range repeats.
  - **Weighted picks** (by date, or how recently a photo was shown): out of scope (spec
    Assumptions).

## R2. Source of randomness

- **Decision**: keep the injected `random: () => number` dependency the engine already has.
  Production passes `Math.random`, and tests pass the seeded `seededRandom()` (mulberry32) from
  `tests/support/state.ts`.
- **Rationale**: `Math.random` is unpredictable across runs (FR-006). This isn't a security
  feature, so a cryptographic source adds nothing. The modulo bias of `Math.floor(r * n)` for
  n ≤ 2000 photos is about 2⁻⁴², far below anything SC-002 could detect.
- **Alternatives considered**: `crypto.randomInt(n)`: exactly unbiased, but it would change the
  injected interface from `() => number` and the existing test seam, for no gain a user could
  see.

## R3. Removing the round state

- **Decision**: delete `RotationState.shownThisRound`. That touches:
  - `src/core/persistence/app-state.ts`: the type and `defaultState()`
  - `src/core/rotation/engine.ts`: `changePhoto`, `stop`, `selectionChanged`
  - `src/core/persistence/state-file.ts`
- **Saved state from feature 001**: `loadState` builds `rotation` from the known keys only, so an
  old `shownThisRound` in `state.json` is dropped on load and is gone after the next save. This
  is the spec edge case "Upgrading from feature 001".
- **`selectionChanged()`**: it now only clears `currentPhotoId` when that photo was removed.
- **Rationale**: Principle II. State with no remaining use is deleted, not kept "just in case".
- **Alternatives considered**: leaving the field unused. That's dead state that would mislead
  future readers, and it would keep being written to disk.

## R4. Testing randomness deterministically

- **Decision**: the statistical success criteria become deterministic unit tests that use the
  seeded generator:
  - **SC-002**: 1,000 picks over N = 4 photos, each count within 250 ± 62.
  - **SC-003**: with N = 3, some photo repeats before all 3 have been shown, within 50 picks.
  - **SC-001**: no two consecutive picks are equal, over 1,000 picks.

  A second seed is run as a sanity check. Each test also asserts the behavior directly with a
  scripted `random`, such as `() => 0` or `() => 0.99`, so failures are easy to explain.
- **Rationale**: Principle I. The tests run fast and offline and never flake, because a seeded
  sequence is fixed.
- **Alternatives considered**: tests that use `Math.random`. They could fail by chance and
  couldn't be reproduced.
