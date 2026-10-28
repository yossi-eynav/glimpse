# Implementation Plan: Google Photos Wallpaper & Screensaver Rotation

**Branch**: `001-photos-wallpaper-rotation` | **Date**: 2026-10-27 (amended: own wallpaper helper replaces the `wallpaper` package) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-photos-wallpaper-rotation/spec.md`, plus these
owner directives:
- "this project should be written in nodejs + electron"
- "use Google client library if possible"
- "remove the wallpaper package … implement on our own"

## Summary

This is an Electron menu bar app: a `Tray` with a native menu, and no Dock icon. When signed
out, the menu offers only "Sign in with Google". Sign-in uses Google's `google-auth-library` for
OAuth with PKCE, through a loopback redirect, with tokens encrypted by the Keychain-backed
`safeStorage`. When signed in, the menu shows every setting.

"Choose Google Photos images…" opens a sandboxed selection window. Through IPC, it asks the main
process to run a Google Photos **Picker API** session in the browser, and to download the chosen
still photos and their thumbnails straight away. All Google calls go through
`OAuth2Client.request()`. Google publishes no generated Node client for the Photos APIs (R11).

A tick-driven `RotationEngine`, written as pure TypeScript, decides which photo to show:
- shuffled with no repeats within a round
- one catch-up change after sleep
- a pause when the user changes the wallpaper themselves

The engine sets the wallpaper through **`pw-helper`**, our own Swift helper that stays running
(R5). It applies the photo to every screen with fill and crop, re-applies it on every Space the
user switches to, and reports manual wallpaper changes as they happen.

The screensaver is our native `.saver`, which reads a file handoff (R6). Both native pieces are
built with `swiftc` by one script, with no Xcode. All behavior lives in `src/core`, which has no
Electron imports and is built test-first with `node:test`, offline.

## Technical Context

**Language/Version**:
- TypeScript 7, using only erasable syntax, on Node.js 24: Electron's bundled Node, and Node
  24.22 for tests.
- Swift (the Command Line Tools' `swiftc`, Swift 6.4 on the development Mac), for two small
  native pieces only: `pw-helper` (about 150 lines) and the screensaver (about 120 lines).

**Primary Dependencies**:
- **Runtime**: `electron` 45 and `google-auth-library` 11.3.1 (Google's official client: OAuth,
  authorized requests, refresh and retries; its bundled gaxios is used through the library's
  re-export). **No `wallpaper` package.**
- **Dev**: `typescript` 7, `@electron-forge/cli` 8 with the zip and dmg makers, and
  `@types/node`.
- **Built-in modules**:
  - Node: `node:http` (the loopback redirect), `node:child_process` (to run `pw-helper`),
    `node:fs/promises`.
  - Electron: `Tray`, `Menu`, `BrowserWindow`, `safeStorage`, `powerMonitor`, `screen`,
    `protocol`, `shell`, `net`, `app.setLoginItemSettings`.
  - AppKit, inside the native pieces: `NSWorkspace` desktop-image APIs, Space and screen
    notifications, `DispatchSource`, and the ScreenSaver framework.
- Each dependency is justified in [research.md](./research.md) R0, R5, R10 and R11.

**Storage**:
- **State**: `userData/state.json`, written atomically.
- **Images**: files under `userData/{Photos,Thumbs}/`.
- **Tokens**: `userData/tokens.bin`, encrypted with `safeStorage` using a Keychain key.
- **Screensaver**: the handoff folder in the screensaver host's container (R6).
- `pw-helper` keeps no state of its own. Its only state is the current photo, held in memory and
  sent to it again after a restart.

**Testing**:
- `node --test` with `node:assert/strict`, running `.ts` files through Node 24 type stripping.
  There are no test dependencies.
- Fakes cover `fetch` (injected into `google-auth-library`), the clock, the file system, the
  secret box, the desktop, the login item, `openExternal`, `isOnline` and `random`.
- **`pw-helper` protocol**:
  - Message encoding and parsing live in `src/core/wallpaper/helper-protocol.ts`, as pure
    functions tested directly.
  - The process client in `src/main/platform/helper-desktop.ts` uses `node:child_process` but
    no Electron. It is tested against `tests/support/fake-helper.mjs`, a Node script that
    speaks the same protocol, covering the request/response pairing, events, crash and restart,
    and the backoff limit.
- The Swift side is covered by the spikes and the manual scenarios in
  [quickstart.md](./quickstart.md).

**Target Platform**: macOS 14 (Sonoma) or later. Apple Silicon and Intel builds
(`--arch=universal`; both native pieces are built universal with `lipo`).

**Project Type**: desktop-app (an Electron menu bar app, plus a native wallpaper helper and a
native screensaver bundle)

**Performance Goals**:
- A wallpaper change applies within 5 s of its scheduled time on all displays (SC-003). One
  `show` round-trip to the running helper takes milliseconds, with no process start per change.
- Switching to a Space shows the current photo within 1 s.
- The screensaver reflects a change within 2 s (SC-007).
- 1,000 photos are saved in under 10 min, with 4 downloads at a time (SC-008).

**Constraints**:
- Under 1% average CPU while idle, across all app processes, including `pw-helper` (SC-009).
  There is one `setTimeout` in the main process. The helper sleeps on its run loop and wakes
  only for Space, screen and wallpaper-store events. There is no polling anywhere.
- Main-process work is all async, with no sync fs or network calls on large data.
- Rotation works offline from saved copies.
- At least 1 GB of disk is kept free.
- Not sandboxed and not a Mac App Store build. It is distributed with a Developer ID and
  notarized. `pw-helper` and the `.saver` are signed with the same identity and the hardened
  runtime.
- Renderers use `contextIsolation`, `sandbox` and a strict CSP.

**Scale/Scope**:
- One user and one account.
- Up to 2,000 photos per picker session.
- 1 tray menu, 2 small windows, 1 helper process, and 1 screensaver.

**Open items** (resolved by spikes):
- **R2**: whether a whole album can be chosen in one action (FR-007).
- **R5**: whether macOS 14 and later rewrite `com.apple.wallpaper/Store/Index.plist` on manual
  and on programmatic wallpaper changes, which the event-driven FR-018 detection relies on.
  There is a documented fallback.
- **R6, part 2**: whether the `legacyScreenSaver` host shows our `.saver` and can read the
  handoff folder. Part 1, building and loading with `swiftc` alone, passed.

The earlier **Spaces deviation is resolved**: `pw-helper` re-applies the current photo on Space
changes, so the spec assumption "all displays and all macOS desktops (Spaces) show the same
photo" holds.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.0) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change. API, OAuth and file-system code is tested without network access | ✅ All decisions stay in `src/core` (R10). The helper protocol is pure and unit-tested. The process client is tested against a fake helper script, with no real wallpaper changes in tests. `tasks.md` must order each test first |
| II. Simplicity | Only current requirements. Each dependency is justified. Deviations are logged | ✅ Two runtime dependencies: Electron (the owner's directive) and `google-auth-library` (the owner's request). The `wallpaper` package is removed. The new native helper is justified in Complexity Tracking: it replaces a dependency and fixes a spec gap (Spaces), and reuses the existing `swiftc` pipeline |
| Desktop: lifecycle | Launch, background, offline, quit or restart | ✅ Restore from `state.json`, `tick()` on launch and wake, `setLoginItemSettings`, single-instance lock. `pw-helper` is restarted with backoff, gets `show <current>` again, and is killed when the app quits |
| Desktop: responsive UI | No blocking on the UI thread | ✅ Helper calls are async messages over a pipe. The main process never waits on AppKit |
| Desktop: credentials | Kept in the OS secure store | ✅ Unchanged: `safeStorage` with a Keychain key. `pw-helper` never sees tokens |
| Desktop: stack recorded, changes justified | The stack, OS and packaging are stated. A change of stack must be justified under Principle II | ✅ Node.js 24 + Electron 45 + TypeScript, plus Swift native pieces, macOS 14+, a notarized Developer ID app built with Forge. The change from the `wallpaper` package to our own helper is logged in Complexity Tracking |

**Pre-design gate**: PASS.

**Post-design re-check** (after data-model.md and contracts/): PASS. The design adds the
`wallpaper-helper` contract and one native binary, and removes one runtime dependency and one
ASAR unpack rule.

## Project Structure

### Documentation (this feature)

```text
specs/001-photos-wallpaper-rotation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── menu-ui.md
│   ├── ipc.md
│   ├── google-photos-picker.md
│   ├── wallpaper-helper.md      # NEW: app ↔ pw-helper protocol
│   └── screensaver-handoff.md
├── checklists/requirements.md
└── tasks.md                     # regenerate with /speckit-tasks after this plan
```

### Source Code (repository root)

The tree reflects the code as implemented. ★ marks what this amendment adds or changes.

```text
package.json                 # ★ scripts: …, build:native (replaces build:saver); no `wallpaper` dependency
tsconfig.json
forge.config.js              # ★ extraResource: build/pw-helper + build/PhotoWallpaperSaver.saver; no asar.unpack
config/google.example.json
assets/trayTemplate.png, trayTemplate@2x.png

src/
├── core/                    # pure TypeScript, no electron imports
│   ├── auth/                google-client.ts, sign-in.ts, sign-out.ts, token-store.ts
│   ├── picker/              models.ts, picker-client.ts
│   ├── library/             selection-draft.ts, selection-session.ts, photo-store.ts, downloader.ts
│   ├── rotation/            clock.ts, shuffle.ts, engine.ts, custom-interval.ts
│   ├── wallpaper/           desktop.ts (★ Desktop gains onExternalChange), ★ helper-protocol.ts
│   ├── screensaver/         handoff.ts, installer.ts
│   ├── persistence/         fs.ts, app-state.ts, state-file.ts
│   ├── menu/                menu-model.ts, notice.ts
│   └── log.ts
├── shared/ipc-types.ts
├── main/
│   ├── main.ts              # ★ starts/stops pw-helper; wires externalChange → engine
│   ├── tray.ts, tray-menu.ts, scheduler.ts, system-events.ts, windows.ts, ipc.ts, protocols.ts
│   └── platform/            ★ helper-desktop.ts (replaces wallpaper-desktop.ts), safe-storage-box.ts,
│                            login-item.ts, loopback-server.ts
├── preload/                 selection.cjs, custom-interval.cjs
└── renderer/                selection/…, custom-interval/…

native/                      # ★ was saver/; one Swift tree for both native pieces
├── helper/main.swift        # ★ pw-helper: JSON lines over stdio; NSWorkspace set/get; Space, screen and store watchers
└── saver/
    ├── PhotoWallpaperSaverView.swift
    └── Info.plist
scripts/
├── copy-static.js
└── build-native.sh          # ★ replaces build-saver.sh: builds universal pw-helper and .saver, then signs both

tests/
├── support/                 fake-fetch.ts, fake-secret-box.ts, fixtures.ts, google.ts, engine.ts, state.ts,
│                            ★ fake-helper.mjs
├── fixtures/
├── core/…                   ★ wallpaper/helper-protocol.test.ts, rotation/external-change.test.ts (event-driven case)
└── main/                    ★ helper-desktop.test.ts (replaces the wallpaper-desktop cases), …
```

**Structure Decision**: a single npm project. Behavior lives in `src/core`, which is
Electron-free and runs under `node --test`. `src/main`, `src/preload` and `src/renderer` are thin
Electron layers. All native code lives under `native/`, is built by one script, and is shipped as
Forge extra resources.

**Migration from the current code** (done by `/speckit-tasks` and `/speckit-implement`, not by
this planning step):
- `npm uninstall wallpaper`.
- Delete `src/main/platform/wallpaper-desktop.ts` and its test cases.
- Remove the `asar.unpack` rule from `forge.config.js`.
- Move `saver/` to `native/saver/`.
- Replace `scripts/build-saver.sh` with `scripts/build-native.sh`.
- Rename the npm script `build:saver` to `build:native`.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Electron instead of native Swift (about 250 MB app, more memory) | The project owner's directive (2026-10-27): the project is written in Node.js + Electron | Native Swift would be smaller, but it was overridden by the owner |
| A native Swift `.saver` inside a Node/Electron project | macOS only loads native `.saver` bundles. FR-019 to FR-021 require a real screensaver | An Electron fullscreen window on idle isn't the macOS screensaver and fails FR-019 and FR-021 (R6) |
| `pw-helper`, our own always-running Swift helper process | The owner asked to remove the `wallpaper` package. Electron has no wallpaper API. Only a long-lived process can hear Space-change notifications, which is what makes "all Spaces show the photo" possible (R5) | A one-shot CLI keeps the Spaces gap. JXA can't set the fill and crop options (tested). A desktop-type BrowserWindow isn't the real wallpaper and costs idle CPU. A Node native addon adds node-gyp and an Electron ABI rebuild for every upgrade |
| A child-process supervisor (restart with backoff) | A crashed helper must not leave the app unable to change the wallpaper | Restarting by hand at every change means a process launch per change, and nothing is listening for Space events between changes |
| The `google-auth-library` runtime dependency | The owner asked to use Google's client library. It owns PKCE, token exchange, refresh, 401 handling, revoke and retries. No generated Photos client exists (R11) | Hand-written OAuth and retry code with `fetch` (the previous decision) was replaced at the owner's request. `googleapis` is 246 MB and has no Photos API |
| TypeScript and Electron Forge (dev dependencies) | Typed IPC across three processes. Signing, notarizing and packaging an `.app` | Plain JS leaves IPC shapes unchecked. Hand-run `codesign` and `notarytool` scripts would re-create what Forge already does |
| Not sandboxed (Developer ID distribution) | The app must write into the screensaver host's container (R6) | A Mac App Store sandboxed build can't write there |
