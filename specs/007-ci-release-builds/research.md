# Research: Automatic downloadable builds

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-31

## R1. Signing without an Apple Developer account

- **Finding (measured 2026-10-31 on `out/Glimpse-darwin-universal/Glimpse.app`)**:
  - `codesign -dv` shows only the main program's automatic signature, the one the linker adds
    at build time (`flags=adhoc,linker-signed`, `Identifier=Electron`).
  - `codesign --verify --deep --strict` reports "code object is not signed at all". Packaging
    changes `Info.plist` and adds resources after linking, so the bundle has no valid seal.
  - On Apple silicon, a downloaded (quarantined) app in that state is reported as "damaged and
    can't be opened", with no "Open Anyway".
- **Decision**: ad-hoc sign the whole bundle after packaging, with
  `codesign --force --deep --sign - <app>`, then `codesign --verify --deep --strict`.
  - It is run from a Forge `hooks.postPackage` hook, only when the notarize path (`APPLE_TEAM_ID`
    plus `NOTARY_KEYCHAIN_PROFILE`) isn't configured.
  - `postPackage` runs before the makers, so the dmg and zip contain the signed app.
- **Consequences**:
  - **Gatekeeper still blocks the first launch**, because the app isn't notarized. The user
    approves it once in System Settings → Privacy & Security → **Open Anyway**. On macOS 15 and
    later, right-click → Open no longer bypasses this.
  - **There is no hardened runtime** (`--options runtime`), because ad-hoc apps don't need it
    and Electron's JIT works without entitlements.
- **Alternatives considered**:
  - **`osxSign: { identity: '-' }` via `@electron/osx-sign`**: not clearly supported for
    ad-hoc identities. It also adds entitlement and hardened-runtime defaults that we'd have to
    undo.
  - **Leaving it unsigned**: produces the "damaged" error.
  - **Documenting `xattr -dr com.apple.quarantine`** as the only path: kept as an advanced tip
    only. Asking users to run a Terminal command isn't "download easily".

## R2. The DMG maker's native modules in CI

- **Finding**: npm 11.19 blocks dependency install scripts that aren't listed in `allowScripts`.
  `npm install-scripts ls` lists `fs-xattr` and `macos-alias` (both `node-gyp rebuild`,
  needed by `@electron-forge/maker-dmg`), plus `esbuild`. Locally they were built earlier. A
  fresh `npm ci` on a runner would skip them, and the dmg maker would fail.
- **Decision**: run `npm install-scripts approve fs-xattr macos-alias esbuild` and commit the
  resulting `allowScripts` in `package.json`.
  - `esbuild` is approved too: its postinstall only checks the platform binary, which is
    harmless, and approving it silences the warning.
  - The runner has Python and Xcode for node-gyp.
- **Alternatives considered**:
  - **`npm ci --ignore-scripts=false` or a global override**: that allows every package's
    scripts, which is broader than needed.
  - **Zip only**: the spec asks for a disk image.

## R3. Runner and toolchain

- **Decision**:
  - Use `runs-on: macos-latest`, which is Apple silicon with Xcode, so `swiftc`, `lipo`,
    `codesign`, `hdiutil` and `gh` are all available.
  - Use `actions/setup-node` with `node-version: 24` and `cache: npm`, then `npm ci`.
  - Use the current major versions of `actions/checkout`, `actions/setup-node` and
    `actions/upload-artifact`, checked and pinned to a major tag at implementation time.
- **Rationale**: the native build must run on macOS. Universal output comes from
  `--arch=universal` (`@electron/universal`) plus the lipo-built helpers, so one runner is
  enough.
- **Alternatives considered**: a matrix of Intel and Apple silicon runners. That's unnecessary,
  because the output is universal, and it would double the minutes.

## R4. Which events do what

| Event | `test` | `package` | `release` |
|-------|--------|-----------|-----------|
| push to any branch | ✅ | ✅ | only `main` |
| pull request from this repository | ✅ | ✅ | ❌ |
| pull request from a fork | ✅ | ❌ (no secrets) | ❌ |
| push of a tag (including `latest`) | ❌ (triggers are `branches: ['**']` only) | ❌ | ❌ |

- **Fork detection**: `package` runs only when `github.event_name == 'push'` or
  `github.event.pull_request.head.repo.full_name == github.repository`. GitHub also withholds
  secrets from fork pull requests on its own.
- **No loops**: tags pushed by the release job use `GITHUB_TOKEN`, and those never trigger
  workflows. The trigger also ignores tags.
- **Permissions**: `contents: read` by default, and `contents: write` only on `release`.

## R5. Cancelling and serializing runs

- **Decision**:
  - The workflow uses `concurrency: { group: build-${{ github.ref }}, cancel-in-progress: true }`,
    so a newer push to the same branch cancels the older run (FR-011).
  - The `release` job has its own `concurrency: { group: release-latest, cancel-in-progress:
    false }`, so latest-release updates run one at a time and are never cut off halfway.
- **Caveat**: an older main run that is already inside `release` can't be cancelled by the
  workflow-level group. That's because the job-level group isn't cancellable, which is what we
  want. The next run then simply replaces it.

## R6. The single "latest" release

- **Decision**:
  1. Move the tag: `git tag -f latest "$GITHUB_SHA"` and `git push -f origin refs/tags/latest`.
  2. If the `latest` release doesn't exist, create it: `gh release create latest --title … --notes-file …
     --latest`.
  3. Otherwise, run `gh release edit latest --title … --notes-file … --latest`.
  4. Upload with `gh release upload latest Glimpse-universal.dmg Glimpse-universal.zip --clobber`.
- **Release asset names are stable** (`Glimpse-universal.dmg` and `Glimpse-universal.zip`), so
  the download links never change:
  `https://github.com/yossi-eynav/glimpse/releases/latest/download/Glimpse-universal.dmg`.
- **The version and commit** appear in the release title, `Glimpse 0.1.0 (abc1234)`, and in the
  notes.
- **Run artifacts carry the commit** in their file names (FR-005), for example
  `Glimpse-0.1.0-abc1234-universal.dmg`.
- **Rationale**:
  - `--clobber` replaces each asset in place, so there's never a moment with no release.
  - Stable names mean the README can link straight to the file.
  - Serialization (R5) keeps the files from two commits from mixing.
- **Alternatives considered**:
  - **Delete and recreate the release every time**: that briefly leaves no download, and it
    resets the release's creation date and URL history.
  - **Names that include the commit**: old assets would have to be deleted by hand, and the
    README couldn't link to a fixed URL.

## R7. Secrets

- **Decision**:
  - There are two repository secrets, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
  - A step fails with `::error::Missing repository secret GOOGLE_CLIENT_ID` (or `…SECRET`) when
    one is empty (FR-009).
  - It then writes `config/google.json` with `jq -n --arg id "$ID" --arg secret "$SECRET"
    '{clientId:$id, clientSecret:$secret}'`. The values are passed through `env:`, never
    interpolated into the script text, and never echoed.
- **Rationale**: GitHub masks secret values in logs. Passing them through `env:` also avoids
  injecting them into the shell command. `config/google.json` stays git-ignored, and the upload
  steps list only the dmg and zip.
- **Note**: the client settings end up inside the shipped app, exactly as with local builds.
  Google classes a Desktop-app client secret as non-confidential.

## R8. Prerequisites for public downloads (owner steps, outside the code)

- **Public repository**: release assets of a private repository can't be downloaded by the
  public. Free macOS runner minutes are also unlimited for public repositories, while private
  ones bill macOS minutes at 10×. This couldn't be checked from here, because `gh` isn't
  installed locally.
- **Google sign-in**: while the OAuth consent screen is in *Testing*, only listed test users
  can sign in. That's a separate step (see spec Assumptions).
