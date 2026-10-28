# Quickstart & Validation: Google Photos Wallpaper & Screensaver Rotation

## Prerequisites

| For | Needs |
|-----|-------|
| Logic tests | Node.js 24 or later (`node -v`) |
| Running the app | The above, plus `npm install` (Electron 45, `google-auth-library` 11.3.1, Electron Forge 8, TypeScript 7) |
| Native pieces (`pw-helper`, screensaver) | Command Line Tools (`xcode-select --install`), for `swiftc` and `lipo`. Full Xcode is **not** required |
| Signing in | A Google Cloud project with the **Photos Picker API** enabled, the OAuth consent screen in "Testing" with your account as a test user, and an OAuth client of type **Desktop app** |
| Release | An Apple Developer ID certificate, and a `notarytool` keychain profile |
| Manual checks | A Google Photos account with an album of more than 100 photos and a few videos. Ideally a second display, and more than one Space |

**Setup**

```sh
npm install
cp config/google.example.json config/google.json   # set clientId and clientSecret
npm run build:native                                # scripts/build-native.sh → build/pw-helper + build/PhotoWallpaperSaver.saver
npm start                                           # tsc, then electron-forge start
```

## Automated checks

```sh
npm test          # node --test over tests/**/*.test.ts; must pass with Wi-Fi off
npm run typecheck # tsc --noEmit over src/ and tests/
```

## Manual validation scenarios

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| 1 | US1 | `npm start` | A tray icon appears in the menu bar, with no Dock icon. The menu is exactly "Sign in with Google" and "Quit" ([menu-ui](./contracts/menu-ui.md)) |
| 2 | US1 | Sign in (the browser opens; approve) | The browser shows "You can close this tab". The full signed-in menu appears, in the contract's order, with your email |
| 3 | US1 | Choose Google Photos images… → Add from Google Photos… → pick 3 photos and 1 video | The browser tab closes. The dialog shows 3 thumbnails and "1 videos skipped" |
| 4 | US1 | **Spike R2**: in the picker, open an album with more than 100 photos and try to select all of them | Record the result in research.md R2. If it isn't possible, run `/speckit-clarify` on FR-007 |
| 5 | US1 | Done → Change every 5 min → Start rotation | The wallpaper changes within 5 s on every display. The status line reads "Next change at …" |
| 6 | US1 | Custom… → 1 minute; wait 3 minutes | Each of the 3 photos is shown once before any repeats |
| 7 | US1 | Connect a second display | It shows the current photo within 5 s |
| 8 | US1 | Create 3 Spaces. With rotation running, switch to each Space in turn | Each Space shows the current photo within 1 s of switching to it (pw-helper `applied` events in the log) |
| 8a | Edge | **Spike R5**: change the wallpaper in System Settings, then run `plutil -p ~/Library/Application\ Support/com.apple.wallpaper/Store/Index.plist` before and after | The file changes. Record the result in research.md R5 |
| 8b | Edge | Kill the helper (`pkill -x pw-helper`), then choose "Next photo" | Within a few seconds the helper is restarted and the wallpaper changes. The log shows one restart |
| 8c | Perf | `ps -o %cpu,rss -p $(pgrep -x pw-helper)` while idle | 0.0 %CPU, and memory under 20 MB |
| 9 | US2 | **Spike R6**, then turn on "Use for screensaver" | The Screen Saver settings pane opens with the instruction dialog. Select "Google Photos Wallpaper" |
| 10 | US2 | Start the screensaver (hot corner); wait for the next change | It shows the current photo within 2 s, then crossfades to the new one |
| 11 | US3 | Pause; wait past the interval; Resume; Next photo | No change while paused. "Next photo" changes it right away |
| 12 | US3 | Package (`npm run make`), install, turn on Start at login, reboot | The app is back in the menu bar, with the same selection, interval and state |
| 13 | Edge | Turn Wi-Fi off and wait for 2 changes | Both changes happen |
| 14 | Edge | Change the wallpaper in System Settings | Status shows "Paused — wallpaper changed in System Settings" **at once** (helper `externalChange`), and switching Spaces doesn't overwrite your choice. Resume → the next change shows a Google photo again |
| 15 | US3 | Sign out | Rotation stops. `~/Library/Application Support/<app>/Photos/` is empty, and the menu is back to sign-in only |
| 16 | Perf | Leave it idle for 30 min with a 15 min interval (Activity Monitor, all app processes) | Average CPU under 1% (SC-009) |
