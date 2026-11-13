# Data Model: Glimpse never pauses on its own

## RotationState (in `state.json`)

| Field | Before | After |
|-------|--------|-------|
| `mode` | `stopped` \| `running` \| `paused` \| `pausedExternalChange` \| `blockedNoPhotos` | `stopped` \| `running` \| `paused` \| `blockedNoPhotos` |
| `currentPhotoId` | unchanged | unchanged |
| `nextChangeAt` | unchanged: non-null only while running | unchanged |

`paused` now has one meaning: the user chose Pause.

## Transitions removed

- `running` → `pausedExternalChange`, at a scheduled change when a screen shows a wallpaper
  from outside the app.
- `running` → `pausedExternalChange`, on the helper's `externalChange` event.
- `pausedExternalChange` → `running`, on Resume.

All other transitions are unchanged. In particular, `running` → `paused` happens only on Pause.

## Migration on load

| Saved `mode` | Loaded as | `nextChangeAt` | Effect at launch |
|--------------|-----------|----------------|------------------|
| `pausedExternalChange` | `running` | kept (null) | `restore()` shows a photo and schedules the next change |
| any other value | unchanged | unchanged | as before |

The next save writes the new mode, so the old value disappears from the file.
