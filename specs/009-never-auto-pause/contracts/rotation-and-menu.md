# Contract: Rotation and menu without the automatic pause

This supersedes the `pausedExternalChange` parts of
[001 menu-ui.md](../../001-photos-wallpaper-rotation/contracts/menu-ui.md) and rule 5 of
[001 wallpaper-helper.md](../../001-photos-wallpaper-rotation/contracts/wallpaper-helper.md).
Those records aren't edited.

## N1. Scheduled change

When `tick()` runs with mode `running` and `nextChangeAt` due, the engine shows a new photo on
every screen and schedules the next change. It doesn't read the current wallpaper first, and
it never pauses.

## N2. Menu

| Mode | Start item | Status line |
|------|------------|-------------|
| `running` | Pause | `Next change …` (or `Running`) |
| `paused` | Resume | `Paused` |
| `blockedNoPhotos` | Start rotation | `Stopped — no photos available` |
| `stopped` | Start rotation | `Rotation stopped` |

No item or status mentions a wallpaper changed in System Settings.

## N3. Helper events

- The `glimpse-helper` protocol is unchanged (version 1). The helper still sends
  `externalChange`, and still stops re-applying on Space and display changes until the next
  `show`.
- The app logs `externalChange` at info level, and the engine is not told. The user's wallpaper
  stays until the next scheduled change, "Next photo", or a selection change. Each of these
  calls `show`, which clears the helper's latch.

## N4. Who can stop rotation

Only the user, through Pause, Turn off or Sign out. Running out of saved photos
(`blockedNoPhotos`) isn't a pause: there's nothing to show.
