# Glimpse

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

## Install

Glimpse runs on macOS 14 (Sonoma) or later, on Apple silicon and Intel Macs. The newest build
is always on the [latest release](https://github.com/yossi-eynav/glimpse/releases/latest):
[Glimpse-universal.dmg](https://github.com/yossi-eynav/glimpse/releases/latest/download/Glimpse-universal.dmg)
or [Glimpse-universal.zip](https://github.com/yossi-eynav/glimpse/releases/latest/download/Glimpse-universal.zip).

1. Download **Glimpse-universal.dmg**, open it, and drag Glimpse to Applications.
2. Open Glimpse. macOS says it can't check it for malware, because Glimpse isn't notarized by
   Apple. Click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to
   Glimpse. Confirm with your password. On macOS 15 and later, right-click → Open no longer
   skips this step.
4. Glimpse appears in the menu bar. You only need to do this once.

After an update, macOS may ask to let Glimpse use its saved sign-in in your Keychain. Choose
**Always Allow**.

If you're comfortable with Terminal, you can skip steps 2–3 by running
`xattr -dr com.apple.quarantine /Applications/Glimpse.app` once after copying the app.

## Requirements (to build from source)

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
npm run build:native # builds build/glimpse-helper and build/Glimpse.saver with swiftc
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
- `native/helper/` is `glimpse-helper`, the wallpaper helper. The app runs it as a child process
  and talks to it over a pipe. It sets the wallpaper, re-applies it on Space changes, and reports
  manual changes. See
  [`contracts/wallpaper-helper.md`](specs/001-photos-wallpaper-rotation/contracts/wallpaper-helper.md).
- `native/saver/` is the screensaver.

Tests never change your real wallpaper: they drive a fake helper (`tests/support/fake-helper.mjs`).

## Package, sign and notarize

```sh
npm run make
```

This builds a universal `.app`, plus a zip and a DMG, in `out/make/`. By default the app is
ad-hoc signed (`scripts/adhoc-sign.sh`, run after packaging), which needs no Apple Developer
account. Users then approve it once with **Open Anyway** (see [Install](#install)).
`scripts/check-package.sh out/Glimpse-darwin-universal/Glimpse.app` checks the signature,
architectures and bundled files.

To sign with a Developer ID and notarize instead, set these environment variables first:

| Variable | Meaning |
|----------|---------|
| `APPLE_TEAM_ID` | Your Apple Developer team ID |
| `NOTARY_KEYCHAIN_PROFILE` | A profile saved with `xcrun notarytool store-credentials` |
| `DEVELOPER_ID` | Used to sign `glimpse-helper` and the screensaver, for example `Developer ID Application: Name (TEAMID)` |

The DMG maker depends on two native modules, `fs-xattr` and `macos-alias`, which build during
install. Their install scripts are approved in `package.json` (`allowScripts`), so `npm ci` and
`npm install` build them.

## Continuous builds

`.github/workflows/build.yml` runs on GitHub Actions:

| Event | What happens |
|-------|--------------|
| Push to any branch | Type check and tests, then a signed dmg and zip, attached to the run for 30 days as `Glimpse-<version>-<commit>` |
| Push to `main` | All of the above, then the [latest release](https://github.com/yossi-eynav/glimpse/releases/latest) is replaced with this build |
| Pull request from this repository | Type check, tests and the build |
| Pull request from a fork | Type check and tests only; forks never get the secrets |

A newer push to the same branch cancels the older run. A failed run never changes the latest
release.

**Setup (once)**: in GitHub, go to **Settings → Secrets and variables → Actions** and add two
repository secrets, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, with the values from your
`config/google.json`. If either is missing, the build fails and names it. The repository must
be public for anyone to download the releases.

## Known limitations

- **Albums are a snapshot.** Google only lets third-party apps read the photos a user picks in
  Google's picker. Photos added to an album later are not picked up automatically; pick them
  again.
- **Screensaver setup.** After you turn on "Use for screensaver", you still have to select
  "Glimpse" once in System Settings → Screen Saver.

## Legal

- [Privacy Policy](PRIVACY.md)
- [Terms of Service](TERMS.md)

Glimpse is not affiliated with Google. Google Photos is a trademark of Google LLC.

## Credits

<a href="https://www.flaticon.com/free-icons/image-comics" title="Image Comics icons">Image Comics icons created by Design Circle - Flaticon</a>
