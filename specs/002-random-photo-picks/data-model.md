# Data Model: Fully Random Photo Picks

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature changes one entity from
[feature 001's data model](../001-photos-wallpaper-rotation/data-model.md). Everything else is
unchanged.

## RotationState (changed)

| Field | Type | Rules |
|-------|------|-------|
| mode | `'stopped' \| 'running' \| 'paused' \| 'pausedExternalChange' \| 'blockedNoPhotos'` | Unchanged |
| currentPhotoId | `string \| null` | Unchanged. It is also the only "history" the picker uses: it is excluded from the next pick when 2 or more photos are available |
| ~~shownThisRound~~ | ~~`string[]`~~ | **Removed** (research R3). It is dropped when an old `state.json` loads, and not written again |
| nextChangeAt | `number \| null` | Unchanged |

The mode transitions are unchanged.

## Choosing the next photo (replaces feature 001's "Choosing the next photo" steps 1–4)

1. Candidates are the selection's photos with `status === 'saved'`.
2. If there are 2 or more candidates, remove `currentPhotoId`.
3. If no candidates remain, there is no pick, and the engine sets `mode = 'blockedNoPhotos'`, as
   before.
4. Otherwise pick `candidates[floor(random() × count)]`, with `random` uniform in [0, 1).

When the selection is edited, the engine only clears `currentPhotoId` if that photo was removed.
There is no round state to adjust.

When the picked photo's saved file is missing or invalid, the engine marks it `unavailable`
(feature 001, FR-024) and picks again. The photo is no longer a candidate, so the loop ends.

## Saved state migration

`loadState` builds `rotation` from the three known keys only:

```text
{ mode, currentPhotoId, nextChangeAt }   ← taken from state.json when present, else defaults
shownThisRound                           ← ignored if present
```
