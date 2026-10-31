# Contract: Names that components rely on

This contract updates the names used by
[`specs/001…/contracts/wallpaper-helper.md`](../../001-photos-wallpaper-rotation/contracts/wallpaper-helper.md)
and `screensaver-handoff.md`. The protocols themselves don't change. Those documents are
historical records, so where a name differs, this contract wins.

| Contract | Producer | Consumer | Value |
|----------|----------|----------|-------|
| C1 Handoff folder | `src/core/screensaver/handoff.ts` (writes `current.jpg`, `manifest.json`) | `native/saver/GlimpseSaverView.swift` (reads them) | `$HOME/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/Glimpse` in the app, and `NSHomeDirectory()` + `Library/Application Support/Glimpse` in the sandboxed saver |
| C2 Saver principal class | `GlimpseSaverView.swift` (`@objc(GlimpseSaverView)`) | `native/saver/Info.plist` (`NSPrincipalClass`) | `GlimpseSaverView` |
| C3 Saver executable | `scripts/build-native.sh` (output and `-module-name`) | `Info.plist` (`CFBundleExecutable`) | `Glimpse` |
| C4 Bundled saver | `build-native.sh` → `build/Glimpse.saver`; `forge.config.js` `extraResource` | `src/main/main.ts` (resource path), `src/core/screensaver/installer.ts` → `~/Library/Screen Savers/Glimpse.saver`, `uninstall.ts` | `Glimpse.saver` |
| C5 Bundled helper | `build-native.sh` → `build/glimpse-helper`; `forge.config.js` `extraResource` | `src/main/main.ts` (`command`) | `glimpse-helper` |

**Rule**: a change to any value is made on the producer's and the consumer's side in the
same commit.
