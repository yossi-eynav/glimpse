# Data Model: Rename map

There is no new data. This map is the single source of truth for every name the rename changes.
"Display" means users see it.

| # | Thing | Old | New | Display? |
|---|-------|-----|-----|----------|
| N1 | App name (`productName`, packager `name`, Finder, menu tooltip, dialogs, sign-in done page) | Google Photos Wallpaper | Glimpse | yes |
| N2 | npm package `name` | google-photos-wallpaper | glimpse | no |
| N3 | App bundle ID | com.example.photowallpaper | com.yossieynav.glimpse | no |
| N4 | Data folder (from N1) | `~/Library/Application Support/Google Photos Wallpaper/` | `~/Library/Application Support/Glimpse/` | in docs |
| N5 | Keychain item (from N1) | Google Photos Wallpaper Safe Storage | Glimpse Safe Storage | in the macOS prompt |
| N6 | Helper binary (build output, `extraResource`, resource lookup, log prefix) | `pw-helper` | `glimpse-helper` | no |
| N7 | Screensaver bundle (build output, `extraResource`, installed path) | `PhotoWallpaperSaver.saver` | `Glimpse.saver` | in docs |
| N8 | Screensaver executable (`CFBundleExecutable`, swiftc `-module-name`) | PhotoWallpaperSaver | Glimpse | no |
| N9 | Screensaver display name (`CFBundleName`) | Google Photos Wallpaper | Glimpse | yes |
| N10 | Screensaver bundle ID | com.example.photowallpaper.saver | com.yossieynav.glimpse.saver | no |
| N11 | Screensaver principal class (`@objc`, `NSPrincipalClass`, Swift type, file name) | PhotoWallpaperSaverView | GlimpseSaverView | no |
| N12 | Handoff folder (inside the legacyScreenSaver container) | `…/Application Support/PhotoWallpaper` | `…/Application Support/Glimpse` | no |

## Rules

- **Display strings use N1 exactly.** Those are:
  - "Glimpse is turned off and your wallpaper is restored."
  - "Select 'Glimpse' in Screen Saver settings"
  - "Glimpse could not start"
  - "Glimpse could not start its wallpaper helper"
  - the tooltip "Glimpse"
  - the done page's title "Glimpse" and "return to Glimpse"
  - the saver's "Glimpse is turned off in the menu"
- **N12 is shared.** The TypeScript and Swift values must be identical (see the
  [contract](./contracts/names.md)).
- **No old name is read.** No code reads N4–N12's old values. The leftovers are removed by hand.
