# Data Model: Apply New Photos on Done, and Turn Off

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

These are changes to `AppState` (`src/core/persistence/app-state.ts`). Everything not listed
stays as in features 001 and 002.

## AppState (changed)

| Field | Type | Rules |
|-------|------|-------|
| power | `'on' \| 'off'` | **New**. Default `'on'`. A `state.json` from before this feature, without the field, loads as `'on'` (FR-013) |
| original | `{ wallpapers: (string \| null)[]; recordedAt: number } \| null` | **New**. Default `null`. `wallpapers[i]` is display *i*'s path from `desktop.get()`, or `null` when that path was inside `Photos/`. Recorded before the first-ever wallpaper change, and on every Turn on (FR-006) |
| account, selection, settings, rotation | — | Unchanged. Turn off keeps them all (FR-010), except that `rotation` becomes stopped |

## Engine runtime state (in memory, not saved)

| Field | Type | Rules |
|-------|------|-------|
| pendingShow | `Set<string> \| null` | The photos added at Done that hadn't finished downloading. Cleared when one is shown, when none is still `pending`, on Turn off, and on the next commit that adds photos |

## Power transitions

```text
on  --Turn off-->  off   side effects, in order: pendingShow = null; rotation = stopped;
                         desktop.restore(original.wallpapers) (restores only displays showing
                         our photos, and stops Space re-apply); if useForScreensaver: handoff
                         disabled and our .saver removed
off --Turn on-->   on    side effects, in order: original = desktop.get() (our photos become
                         null); start(), which shows a random saved photo and sets mode
                         running; if useForScreensaver: reinstall the .saver, then the
                         "select it" message
```

While `power === 'off'`, `start`, `tick`, `next`, `resume`, `restore` (launch), `displaysChanged`,
`photoStatusChanged` and the Done handling in `selectionChanged` are all **no-ops** for the
wallpaper and screensaver (FR-011). State edits through `update()`, such as a sign-out or saving
a selection, are still allowed.

## Done with new photos

`selectionChanged({addedIds})`, when `power === 'on'` and `addedIds` isn't empty:

1. Set `mode = 'running'` (FR-003).
2. Let `ready` be the photos in `addedIds` with `status === 'saved'`.
3. **If `ready` isn't empty**:
   1. `id = pickRandom(currentPhotoId, {photos: ready}, random)`
   2. If `isValidJpeg(id)`, show it. Otherwise mark it `unavailable` and repeat from step 2.
   3. `nextChangeAt = now + interval`, and clear `pendingShow`.
4. **Otherwise**: `pendingShow = new Set(addedIds)`, and leave the wallpaper as it is.
   `nextChangeAt` stays as scheduled, or becomes `now + interval` if it was `null`.

`photoStatusChanged(id, status)` also updates the photo's status in `selection`. Then:

- If `pendingShow` contains `id` and `status === 'saved'`, show `id` (applying the
  `isValidJpeg` check), reschedule, and clear `pendingShow`.
- Otherwise, if none of `pendingShow` is still `pending`, clear `pendingShow`. If nothing is on
  screen (`currentPhotoId === null`) and some photo is saved, make a normal change.

The existing removal handling is unchanged: if the photo on screen was removed,
`currentPhotoId = null`.
