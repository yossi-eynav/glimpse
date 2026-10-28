# Google Photos Wallpaper

A macOS menu bar app that rotates your desktop wallpaper, and optionally your screensaver,
through photos you choose from Google Photos.

- **Menu bar only**: there is no Dock icon. Every option is in the menu bar menu. When you are
  signed out, the only option is **Sign in with Google**.
- **Choosing photos**: "Choose Google Photos images…" opens a selection window. **Add from Google
  Photos…** opens Google's picker in your browser, and the photos you pick are saved on your Mac,
  so rotation keeps working offline.
- **Rotation**: pick an interval from 1 minute to 7 days. Each change shows a random photo from
  your selection, never the one already on screen. The photo fills the screen on every display
  and on every Space (desktop) you switch to. If you pick a wallpaper yourself in System
  Settings, rotation pauses instead of overwriting it.
- **Screensaver**: optional, and shows the same photo as the wallpaper.
- **Privacy**: the app has read-only access to the photos you pick. Photos and tokens stay on
  your Mac, and tokens are encrypted with a key kept in your Keychain.

The full specification is in [`specs/001-photos-wallpaper-rotation/`](specs/001-photos-wallpaper-rotation/).

## Requirements

- macOS 14 (Sonoma) or later
- Node.js 24 or later
- Command Line Tools (`xcode-select --install`), for `swiftc` and `lipo`, which build the two
  native pieces. Full Xcode is not needed.

## Google Cloud setup

1. Create a project at <https://console.cloud.google.com/> and enable the **Photos Picker API**.
2. Configure the **OAuth consent screen**. While it is in *Testing*, add your Google account as a
   test user. In Testing mode, refresh tokens expire after 7 days, so expect to be asked to sign
   in again.
3. Create an **OAuth client ID** of type **Desktop app**.
4. Copy the config file and fill in the client ID and secret:

   ```sh
   cp config/google.example.json config/google.json
   ```

   `config/google.json` is git-ignored. Google treats a Desktop-app client secret as not
   confidential, but keep it out of version control anyway.

## Develop

```sh
npm install
npm test             # every behavior test; runs offline, no network access
npm run typecheck
npm run build:native # builds build/pw-helper and build/PhotoWallpaperSaver.saver with swiftc
npm start            # compiles TypeScript and launches the app in the menu bar
```

All behavior lives in `src/core/`, which has no Electron imports and is tested with `node:test`.
`src/main/`, `src/preload/` and `src/renderer/` are thin Electron layers.

The photo selection window is built with [MUI](https://mui.com) (Material UI) on React. Its
dependencies are React, MUI and Emotion. `npm run build` compiles the main process with `tsc`
and bundles that window with esbuild into `dist/renderer/selection/selection.js`. Its text and
states live in `src/renderer/selection/view-model.ts`, which is unit-tested; the components are
checked by a render test that uses `react-dom/server`.

`native/` holds the two small Swift pieces:
- `native/helper/` is `pw-helper`, the wallpaper helper. The app runs it as a child process and
  talks to it over a pipe. It sets the wallpaper, re-applies it on Space changes, and reports
  manual changes. See
  [`contracts/wallpaper-helper.md`](specs/001-photos-wallpaper-rotation/contracts/wallpaper-helper.md).
- `native/saver/` is the screensaver.

Tests never change your real wallpaper: they drive a fake helper (`tests/support/fake-helper.mjs`).

## Package, sign and notarize

```sh
npm run make
```

This builds a universal `.app`, plus a zip and a DMG, in `out/make/`. To sign and notarize, set
these environment variables first:

| Variable | Meaning |
|----------|---------|
| `APPLE_TEAM_ID` | Your Apple Developer team ID |
| `NOTARY_KEYCHAIN_PROFILE` | A profile saved with `xcrun notarytool store-credentials` |
| `DEVELOPER_ID` | Used to sign `pw-helper` and the screensaver, for example `Developer ID Application: Name (TEAMID)` |

The DMG maker depends on two native modules, `fs-xattr` and `macos-alias`. npm blocks their
install scripts by default, so approve them first with
`npm install-scripts approve fs-xattr macos-alias`, then run `npm install` again. The zip maker
works without them.

## Known limitations

- **Albums are a snapshot.** Google only lets third-party apps read the photos a user picks in
  Google's picker. Photos added to an album later are not picked up automatically; pick them
  again.
- **Screensaver setup.** After you turn on "Use for screensaver", you still have to select
  "Google Photos Wallpaper" once in System Settings → Screen Saver.

## Legal

- [Privacy Policy](PRIVACY.md)
- [Terms of Service](TERMS.md)

Glimpse is not affiliated with Google. Google Photos is a trademark of Google LLC.
