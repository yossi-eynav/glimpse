# Research: Rename the app to Glimpse

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-31

## R1. Inventory of old names (from the repository, 2026-10-31)

The search excluded `node_modules`, `dist`, `build`, `out`, `.git`, `specs/` and
`package-lock.json`, and was case-insensitive. The patterns were: `google photos wallpaper`,
`google-photos-wallpaper`, `photowallpaper`, `photo wallpaper`, `pw-helper`.

| Area | Files |
|------|-------|
| App identity | `package.json` (`name`, `productName`), `forge.config.js` (`name`, `appBundleId`, `extraResource`) |
| Display strings | `src/main/main.ts` (4), `src/main/tray.ts`, `src/main/platform/loopback-server.ts` (2), `native/saver/PhotoWallpaperSaverView.swift` (the turned-off message), `native/saver/Info.plist` (`CFBundleName`) |
| Native names | `scripts/build-native.sh`, `native/saver/Info.plist`, the saver Swift source (class and `@objc` name, handoff path), `native/helper/main.swift` (log prefix, usage) |
| Core paths | `src/core/screensaver/handoff.ts`, `installer.ts`, `uninstall.ts` |
| Main-process paths and logs | `src/main/main.ts` (helper and saver resource paths), `src/main/platform/helper-desktop.ts` (log and error text) |
| Comments | `src/core/wallpaper/desktop.ts`, `helper-protocol.ts` |
| Tests | `tests/core/screensaver/{handoff,installer,uninstall}.test.ts`, `tests/main/helper-desktop.test.ts` (temp dir prefix), `tests/core/rotation/{engine,external-change}.test.ts` (comments), `tests/support/fake-helper.mjs` (comment) |
| Docs | `README.md` (title, build output, helper name, screensaver step), `PRIVACY.md` (saver path), `.specify/memory/constitution.md` (only the leftover report comment) |

**Kept on purpose**: every "Google Photos" that names Google's service, for example the
menu item "Choose Google Photos images…", the selection window title, "Add from Google
Photos", and "your Google Photos library" (FR-002).

## R2. Data folder and Keychain key follow `productName`

- **Decision**: rely on Electron's defaults. Setting `productName: "Glimpse"` makes
  `app.getPath('userData')` `~/Library/Application Support/Glimpse`. It also gives the
  `safeStorage` Keychain item the name "Glimpse Safe Storage". No code calls `app.setName`.
- **Consequence**: Glimpse can't read the old `tokens.bin`, which is in the old folder and was
  encrypted with the old key. It starts signed out. That matches the clarification ("start
  fresh") and the spec's assumption that users sign in again.
- **Alternatives considered**: `app.setPath('userData', …)` pointing at the old folder. That's
  a migration in disguise, and it was rejected by the clarification.

## R3. Screensaver class name

- **Decision**: rename the principal class from `PhotoWallpaperSaverView` to
  `GlimpseSaverView`. Change the `@objc` name, `NSPrincipalClass` and the Swift file together.
- **Rationale**: `legacyScreenSaver` loads saver bundles into one Objective-C runtime. If the
  owner's old `PhotoWallpaperSaver.saver` is still installed, two bundles defining the same
  class name would conflict, and the runtime warns and uses whichever loaded first. A new class
  name avoids that before the manual clean-up is done.
- **Alternatives considered**: keeping the class name, the smallest change. Rejected because of
  the clash above and because of FR-007.

## R4. Bundle identifiers

- **Decision**: the app is `com.yossieynav.glimpse` and the screensaver is
  `com.yossieynav.glimpse.saver`.
- **Rationale**: FR-003 says identifiers move to the owner's own namespace, and reverse-DNS
  based on the GitHub handle `yossi-eynav` is conventional (hyphens dropped). The current
  `com.example.*` identifiers are placeholders.
- **Alternatives considered**: `io.github.yossi-eynav.glimpse`. Valid, but longer, with no
  benefit.

## R5. The handoff folder must change on both sides at once

- **Decision**: the folder becomes `…/legacyScreenSaver/Data/Library/Application Support/Glimpse`.
  It's changed in `src/core/screensaver/handoff.ts` and in the saver's Swift source in the same
  commit, and recorded in [contracts/names.md](./contracts/names.md).
- **Rationale**: a mismatch shows nothing in the screensaver, and no test would catch it,
  because the Swift side is checked only by hand. So the contract and quickstart step 5 cover it.
