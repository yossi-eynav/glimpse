# Contract: App → Screensaver Handoff

The Electron main process writes, and the native `.saver` reads. Source:
[research.md R6](../research.md#r6-screensaver-fr-019-to-fr-021-partly-open).

**Folder** (to be confirmed by the R6 spike):
`~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper/`

| File | When written | Content |
|------|--------------|---------|
| `current.jpg` | On every wallpaper change while `useForScreensaver` is on | A copy of the current `Photos/{id}.jpg` |
| `manifest.json` | Right after `current.jpg`, atomically (write `manifest.json.tmp`, then `rename`) | `{"version": 1, "photoId": "<id>", "updatedAt": "<ISO-8601>", "enabled": true}` |

## Rules

1. **Write order**: `current.jpg` first, then `manifest.json`. The saver reloads the image only
   when `photoId` changes, so it never reads a partly written image.
2. **Turning off `useForScreensaver`**: the app writes the manifest with `"enabled": false` and
   then stops writing. The saver shows black plus the text
   `Google Photos Wallpaper is turned off in the menu`.
3. **Polling**: the saver checks the manifest once per `animateOneFrame`
   (`animationTimeInterval = 1.0`). It draws `current.jpg` so it fills the screen with center
   cropping, matching FR-015, with a 0.5 s crossfade when the photo changes.
4. **Missing, unreadable, or unknown `version`**: the saver shows black. It never throws or
   crashes the host.
5. **Versioning**: an incompatible change bumps `version`. The TypeScript writer
   (`src/core/screensaver/handoff.ts`) and the Swift reader each own their side of this
   contract.

## Installing the saver

- **Built by**: `scripts/build-native.sh`, which runs `swiftc` from the Command Line Tools. It
  produces `build/PhotoWallpaperSaver.saver` from `native/saver/`, alongside `build/pw-helper`
  ([wallpaper-helper.md](./wallpaper-helper.md)).
- **Bundled at**: `Contents/Resources/PhotoWallpaperSaver.saver`, through Forge's
  `extraResource`.
- **Installed to**: `~/Library/Screen Savers/PhotoWallpaperSaver.saver`, replacing any older
  copy, when "Use for screensaver" is turned on.
- **Then**: the app opens
  `x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension` and shows a dialog
  saying "Select 'Google Photos Wallpaper' in Screen Saver settings" (FR-021).
