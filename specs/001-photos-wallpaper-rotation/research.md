# Research: Google Photos Wallpaper & Screensaver Rotation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-27
(re-planned for **Node.js + Electron**, at the project owner's direction)

Each entry records the decision, why it was chosen, and what else was considered. Entries marked
**open** are resolved by a spike task, not by guessing.

## R0. Stack: Node.js + Electron (owner directive)

- **Decision**:
  - **Electron 45** (current stable as of 2026-10), with its bundled Node.js.
  - **TypeScript 7**, a dev dependency used only for type checking and for emitting the
    Electron main, preload and renderer code.
  - Packaging with **Electron Forge 8**.
  - The development machine has Node 24.22 and npm 11.19.
- **Rationale**:
  - The project owner chose Node.js + Electron.
  - TypeScript is added because three processes (main, preload and renderer) share message and
    state types. Typed IPC catches mismatches at build time.
- **Consequences**:
  - Electron has no API for the desktop wallpaper or for screensavers. R5 and R6 cover those
    gaps.
  - Compared with the earlier native Swift plan, the app is larger (about 250 MB) and uses more
    memory. CPU at idle can still meet SC-009, because nothing polls (R8).
- **Alternatives considered**:
  - **Plain JavaScript**: no build step, but the IPC and state shapes would be untyped.
  - **electron-builder**: equally capable. Forge is the packager the Electron project itself
    maintains, and it has built-in `osxSign` and `osxNotarize`.

## R1. How the app gets photos from Google Photos

- **Decision**: Use the **Google Photos Picker API**
  (`https://photospicker.googleapis.com/v1`), with the scope
  `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`. Every call is made from the
  main process through **`google-auth-library`'s `OAuth2Client.request()`** (see R11). That
  attaches the bearer token, refreshes it when needed, and retries. For each "Add from Google
  Photos…":
  1. `POST /sessions` returns `id`, `pickerUri`, `pollingConfig` and `expireTime`.
  2. Open `pickerUri + "/autoclose"` with `shell.openExternal`.
  3. Poll `GET /sessions/{id}` at `pollInterval`, until `mediaItemsSet` is `true` or
     `timeoutIn` runs out.
  4. Page through `GET /mediaItems?sessionId=…`.
  5. For each still photo, download right away, sending `Authorization: Bearer`:
     - `{baseUrl}=w{W}-h{H}` for the wallpaper, where W×H is the largest display's pixel size
     - `{baseUrl}=w256-h256-c` for a square thumbnail
  6. `DELETE /sessions/{id}`.
- **Rationale**:
  - Since 2025 the Library API only returns media the app itself created, so the Picker API is
    the only supported way.
  - `baseUrl` values work for 60 minutes, which forces an immediate download. That download
    doubles as the offline copy FR-010 needs.
  - Google resizes and crops on its side, so the app needs no image-processing library.
  - `maxItemCount` defaults to 2000 per session.
- **Alternatives considered**:
  - **Library API album listing**: no longer allowed.
  - **A generated Photos client from `googleapis`**: none exists (see R11).
  - **`sharp` for local thumbnails**: a native dependency the `-c` crop parameter makes
    unnecessary.
- **Consequences**:
  - The selection is a snapshot.
  - The saved copy is the photo's only lasting record. "Unavailable" (FR-024) means "saved file
    missing or not a valid JPEG".

## R2. Choosing a whole album in one action (FR-007): **open**

- **Finding**: The Picker documentation describes picking individual items. It doesn't say
  whether an album can be chosen, or selected all at once. The app can't add this, because the
  picker runs on Google's site.
- **Decision**: The first task is a spike done by a person: open an album of more than 100
  photos in the picker and try to select all of them.
  - **If it works**: FR-007 is met by the picker.
  - **If it doesn't**: amend FR-007 through `/speckit-clarify` before US1's album scenario is
    built.

## R3. The selection dialog

- **Decision**:
  - A `BrowserWindow` (about 720×560, not resizable below 560×420) showing a local renderer page.
  - Security settings: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and
    a strict CSP of `default-src 'self'; img-src photo:`.
  - The renderer only talks to the main process through a `contextBridge` preload API (see
    [contracts/ipc.md](./contracts/ipc.md)).
  - Thumbnails load through a custom `photo://thumb/{id}` protocol, registered with
    `protocol.handle` in the main process. It serves only files under the app's `Thumbs/`
    folder.
  - **Add from Google Photos…** runs the Picker flow (R1) in the main process. The renderer
    shows "Finish choosing in your browser…" with Cancel, until the main process reports the
    result.
  - **Done** commits the draft; **Cancel** throws it away (FR-008).
  - The renderer is plain TypeScript, HTML and CSS, with no UI framework. It is one grid, one
    header and four buttons.
- **Rationale**: Google blocks its sign-in inside embedded web views, so the picker must run in
  the system browser. A plain renderer keeps the dependency count at zero (Principle II).
- **Alternatives considered**:
  - **Loading `pickerUri` in a BrowserWindow**: blocked by Google's embedded-webview policy.
  - **React or Vue**: unjustified for a single small screen.

## R4. Signing in (OAuth) from Electron

- **Decision**:
  - **Flow**: OAuth 2.0 Authorization Code with PKCE (S256) and a **loopback redirect**, as RFC
    8252 and Google recommend for desktop apps.
    1. The main process starts a Node `http` server on `127.0.0.1` with an ephemeral port.
    2. It opens the authorize URL with `shell.openExternal`.
    3. The server accepts one `GET /?code=…&state=…`, checks that `state` matches, and replies
       with a small "You can close this tab" page. Then it closes.
    4. The flow times out after 5 minutes.
  - **Library**: Google's **`google-auth-library` 11.3.1** `OAuth2Client` (see R11) provides:
    - **PKCE**: `generateCodeVerifierAsync()`
    - **Authorize URL**: `generateAuthUrl({access_type: 'offline', prompt: 'consent', scope,
      code_challenge_method: S256, code_challenge, state})`
    - **Code exchange**: `getToken({code, codeVerifier, redirect_uri})`
    - **Refresh**: automatic, with `eagerRefreshThresholdMillis: 60000`
    - **Token persistence**: the `tokens` event, which saves refreshed tokens
    - **Revoke**: `revokeToken()`

    The app still supplies the loopback server and the `state` check, because the library
    doesn't run a redirect listener.
  - **Client**: a Google OAuth client of type **Desktop app**. Google issues these a client
    secret that is not confidential, and requires it at the token endpoint. It is kept in a
    git-ignored `config/google.json` and bundled at build time.
  - **Scopes**: the Picker scope, `openid` and `email`. The email is read by decoding the
    `id_token` payload. OIDC allows skipping signature checks for a token received directly
    from the token endpoint over TLS. `verifyIdToken()` would add a network call to fetch
    Google's certificates.
  - **Token storage**: Electron `safeStorage.encryptString` encrypts the tokens JSON, which is
    written to `userData/tokens.bin`. On macOS, the encryption key lives in the user's
    **Keychain** (the "… Safe Storage" item). The tokens are never in `state.json` or in logs.
  - **Sign-out**: delete `tokens.bin`, then `POST https://oauth2.googleapis.com/revoke`. Local
    cleanup finishes even if the revoke call fails.
- **Rationale**:
  - Google's own library handles the token lifecycle. Only the loopback server (`node:http`)
    and storage (`safeStorage`) are the app's code.
  - The constitution requires the OS secure credential store. `safeStorage` is backed by a
    Keychain key, so a copy of `tokens.bin` can't be read on another account or machine.
- **Alternatives considered**:
  - **`keytar`**: archived and unmaintained, and a native module.
  - **Hand-written OAuth with `fetch`**: chosen in the previous pass. Replaced at the owner's
    request to use Google's client library (R11).
  - **`@google-cloud/local-auth`**: Google's sample-oriented loopback helper. It needs a key
    file on disk, has no `state` check or timeout control, and doesn't let the app supply the
    redirect page.
  - **Custom URL scheme redirect**: needs an "iOS" client type, and protocol registration
    differs between development and packaged builds.
- **Operational notes**:
  - While the Google Cloud project is in "Testing", refresh tokens expire after 7 days, so
    developers will see "Sign in again".
  - The scope may need Google's OAuth verification before public release.

## R5. Setting the wallpaper: our own Swift helper (replaces the `wallpaper` package)

- **Decision** (owner request, 2026-10-27: "remove the wallpaper package … implement on our
  own"): ship **`pw-helper`**, a small Swift command-line program (about 150 lines) that stays
  running.
  - **Build and launch**: it is built with `swiftc` from the same native tree and script as the
    screensaver (R6). The Electron main process starts it as a child process, and the two talk
    over stdin/stdout with one JSON message per line (see
    [contracts/wallpaper-helper.md](./contracts/wallpaper-helper.md)).
  - **Applying a photo** (`show <path>`): for each `NSScreen`, call
    `NSWorkspace.shared.setDesktopImageURL(_:for:options:)` with
    `.imageScaling = .scaleProportionallyUpOrDown` and `.allowClipping = true`. That gives fill,
    keeping proportions, cropped around the center (FR-013, FR-015). The helper then remembers
    the photo as current.
  - **Spaces**: the helper observes `NSWorkspace.activeSpaceDidChangeNotification` and
    `NSApplication.didChangeScreenParametersNotification`. When the active Space or the set of
    screens changes, it re-applies the current photo to any screen that isn't showing it. This
    **removes the earlier Spaces limitation**: every Space you visit shows the current photo, as
    the spec assumes ("all displays and all macOS desktops").
  - **Detecting manual changes (FR-018)**: the helper watches
    `~/Library/Application Support/com.apple.wallpaper/Store/Index.plist`, the store that macOS
    14+ System Settings writes when the wallpaper changes, using a `DispatchSource` file-system
    watcher.
    - It only uses the file as a "something changed" signal and never parses its undocumented
      format.
    - A change that doesn't come within 3 s of the helper's own `setDesktopImageURL` call, and
      that leaves a screen showing a path outside the app's `Photos/` folder, is reported as
      `externalChange`.
    - The app then pauses rotation (`pausedExternalChange`), and the helper stops re-applying
      on Space changes until it receives the next `show`. That way a wallpaper the user chose is
      never overwritten.
    - The existing check before each scheduled change (`get`, then a path test) stays as a
      fallback.
  - **Reading the wallpaper** (`get`): `desktopImageURL(for:)` for each screen.
  - **Lifecycle**: one helper for the app's lifetime. If it exits unexpectedly, the main process
    restarts it, with backoff (1 s, 2 s, 4 s, and at most 5 restarts in 10 minutes), and sends
    `show <current>` again. While it is down, a wallpaper change fails, rotation keeps its
    schedule, and the next tick retries.
  - **Idle cost**: it sleeps on its run loop, with no polling (SC-009).
- **Rationale**:
  - Removes the third-party runtime dependency, and with it the binary inside it and the ASAR
    unpack rule.
  - Gives full control of scaling and per-screen behavior.
  - Fixes Spaces, which no one-shot approach can do, because only a long-lived process can hear
    Space-change notifications.
  - The project already builds native code with `swiftc` (the screensaver), so this adds no new
    toolchain.
- **Alternatives considered** (brainstorm, 2026-10-27):
  - **A one-shot Swift CLI per change**: a simpler process model, but the Spaces limitation
    stays, and manual changes are only noticed at the next scheduled change.
  - **JXA through `osascript -l JavaScript` with the ObjC bridge**: needs no compile step. In a
    test on the development Mac, reading worked (0.3 s per call), but the AppKit option constants
    (`NSWorkspaceDesktopImageScalingKey`, `…AllowClippingKey`) did not bridge, so the options
    dictionary came out empty and fill-and-crop couldn't be set reliably. It also has no Space
    events.
  - **An Electron `BrowserWindow({type: 'desktop'})` behind the desktop icons**: pure JS and
    covers all Spaces. But it isn't the real wallpaper: the lock screen, Mission Control and
    System Settings show the old one. It needs an always-running renderer per display, which
    risks SC-009, and FR-018 stops making sense.
  - **A native Node addon (N-API, Objective-C++)**: needs node-gyp and an Electron ABI rebuild
    for every Electron upgrade. That is more build complexity than a separate process.
  - **Keeping the `wallpaper` npm package**: rejected by the owner. It also can't do Spaces.
- **Implementation status (2026-10-27)**: the watcher is built into `pw-helper` (task T105),
  ahead of the spike below, because it is harmless if the store never changes.
- **Open item (spike)**: confirm on macOS 14 and on the development Mac (macOS 27) that:
  1. `Index.plist` is rewritten when the wallpaper is changed in System Settings
  2. it is also rewritten by our own `setDesktopImageURL` calls, which is why the 3 s
     self-suppression window exists

  If the file isn't a reliable signal on some version, FR-018 falls back to the existing
  check before each scheduled change. Space re-apply is then limited to Spaces still showing
  one of our photos or the wallpaper recorded at Start.

## R6. Screensaver (FR-019 to FR-021): **partly open**

- **Finding**: macOS only runs screensavers that are `.saver` bundles of native code. Electron
  can't produce one.
- **Decision**:
  - Keep the screensaver as native code: `native/saver/PhotoWallpaperSaverView.swift`, a
    `ScreenSaverView` subclass of about 120 lines. It shares the native tree and the build script
    `scripts/build-native.sh` with `pw-helper` (R5).
  - Build it with **`swiftc` from the Command Line Tools**, using `scripts/build-native.sh`, with
    no Xcode project. It is ad-hoc signed in development, and signed with the Developer ID at
    release.
  - Forge's `extraResource` puts it into the app's `Contents/Resources/`.
  - Turning on "Use for screensaver" copies it to `~/Library/Screen Savers/` and opens
    `x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension`, with a dialog telling
    the user what to select.
  - The saver reads a handoff folder (see
    [contracts/screensaver-handoff.md](./contracts/screensaver-handoff.md)) once a second, and
    reloads the image only when the photo ID changes (FR-020, SC-007).
- **Handoff location**: Since macOS 14, savers run inside Apple's sandboxed `legacyScreenSaver`
  host. The app writes to that host's container, at
  `~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper/`.
  The Electron app isn't sandboxed (it isn't a Mac App Store build), so it can write there.
- **Open part**: A spike confirms two things on the development Mac (macOS 27) and on macOS 14:
  1. a `.saver` built with `swiftc` alone, without Xcode, loads
  2. it can read that folder

  If the build fails, US2 needs Xcode installed. If the read fails, try the saver reading the
  app's own `userData` folder instead. Record the result here.
- **Spike T010, part 1 (2026-10-27, macOS 27.0.1, Swift 6.4 Command Line Tools, no Xcode): PASS.**
  - **Build command**: `swiftc -parse-as-library -module-name <Name> -target arm64-apple-macos14.0
    -Xlinker -bundle -framework ScreenSaver -framework AppKit <file>.swift -o
    <Name>.saver/Contents/MacOS/<Name>`. Add a hand-written `Contents/Info.plist`
    (`CFBundlePackageType` = `BNDL`, and `NSPrincipalClass` matching
    `@objc(<ClassName>)`). Then `codesign -s - --force`.
  - **Result**: a Mach-O arm64 bundle with a valid ad-hoc signature. `Bundle.load()` returns
    true, and its `principalClass` resolves to the view class.
  - **Universal build**: repeat with `-target x86_64-apple-macos14.0` and merge the two with
    `lipo -create`.
- **Spike T010, part 2: NOT YET RUN (needs a person).** Install the bundle in
  `~/Library/Screen Savers/`, select it in System Settings, and confirm that the
  `legacyScreenSaver` host shows it and can read `current.jpg` from the handoff folder.
- **Alternatives considered**:
  - **An Electron fullscreen window on idle** (`powerMonitor.getSystemIdleTime()`) acting as a
    "screensaver": pure JavaScript, but it isn't the macOS screensaver. It wouldn't appear in
    System Settings, and it would fight the real screensaver and the lock screen. It also
    doesn't meet FR-019 or FR-021 as written. This is the fallback only if the owner amends the
    spec.
  - **Apple's built-in photo slideshow saver pointed at a folder**: can't be set reliably from
    code, and can't show exactly the current photo.

## R7. Menu bar app shape

- **Decision**:
  - The tray is an Electron `Tray` with a template image (`assets/trayTemplate.png` and `@2x`).
    Its menu comes from `Menu.buildFromTemplate(toElectronMenu(menuModel(state)))`, and is
    rebuilt with `tray.setContextMenu` on every state change. On macOS, that gives a native
    menu bar menu.
  - **No Dock icon**: `LSUIElement: true` through Forge's `packagerConfig.extendInfo`, plus
    `app.dock.hide()` in development.
  - **Single instance**: `app.requestSingleInstanceLock()`.
  - **No windows open is the normal state**: `window-all-closed` doesn't quit the app (FR-001).
- **Rationale**: Built into Electron, and the native menu matches the "top menu" requirement.
- **Alternatives considered**: a custom popover window under the tray icon. That's
  non-native, more code, and the spec asks for a menu.

## R8. Timing, sleep and start at login

- **Decision**:
  - `RotationEngine` (pure TypeScript in `src/core`) has no timer of its own. It exposes
    `tick()`, which makes a change when `clock.now() >= nextChangeAt`, and the `nextChangeAt`
    value.
  - `src/main/scheduler.ts` sets one `setTimeout` to `nextChangeAt`, and resets it whenever
    `nextChangeAt` changes. The maximum interval of 7 days is well under `setTimeout`'s limit
    of about 24.8 days.
  - **Wake** (`powerMonitor` `resume`) and launch call `tick()` once. With one absolute
    deadline, a Mac that slept through several intervals makes exactly one change (FR-017).
  - **Tests**: the `Clock` interface is `{now(): number; sleep(ms): Promise<void>}`. The test
    `ManualClock` moves `now` forward inside `sleep` and resolves at once, so polling and
    backoff are tested without real waits.
  - **Start at login**: `app.setLoginItemSettings({openAtLogin})` and
    `app.getLoginItemSettings()` (FR-023).
- **Rationale**: Engine tests stay synchronous and deterministic. The app does no polling while
  idle (SC-009).
- **Alternatives considered**: `setInterval` ticking every minute: wastes wakeups and drifts.

## R9. Storage

- **Decision**:
  - **State**: `app.getPath('userData')/state.json` (settings, selection and rotation state),
    written atomically: write `state.json.tmp`, then `fs.rename`.
  - **Photos**: `userData/Photos/{id}.jpg` and `userData/Thumbs/{id}.jpg`.
  - **Tokens**: `userData/tokens.bin`, encrypted with `safeStorage` (R4).
  - **Low disk space**: `fs.statfs(userData)` gives `bavail × bsize`. Stop downloading if less
    than 1 GB would be left.
  - **Valid photo check**: the file exists and starts with the JPEG marker `FF D8 FF`.
- **Rationale**: The app has a few kilobytes of state, so a JSON file is the simplest choice
  (Principle II).
- **Alternatives considered**:
  - **`electron-store`**: a dependency for about 30 lines of code.
  - **SQLite**: unjustified for this amount of data.

## R10. Testing (Principle I)

- **Decision**:
  - **Runner**: Node's built-in **`node:test`** and `node:assert/strict`, running the `.ts`
    files directly with Node 24's built-in type stripping. There are **no test dependencies**.
    - Code in `src/core` and in the tests uses only *erasable* TypeScript syntax
      (`erasableSyntaxOnly`): no enums, namespaces or parameter properties.
    - Imports use `.ts` extensions. tsc rewrites them to `.js` when building
      (`rewriteRelativeImportExtensions`).
  - **Layout**: all behavior lives in `src/core`, which has no `electron` imports and takes
    every dependency as an argument:
    - `fetch`, passed to `google-auth-library` as `transporter: new Gaxios({fetchImplementation})`,
      so tests run the real `OAuth2Client` against fakes
    - a `Clock`
    - a `FileSystem`
    - a `SecretBox` (encrypt/decrypt)
    - a `Desktop` (get/set the wallpaper)
    - a `LoginItem`
    - `openExternal`
    - `isOnline`
    - a random generator
  - **Network**: tests pass a fake `fetch` that serves recorded JSON from `tests/fixtures/` and
    records every request. No test reaches the network.
  - **Electron layers** (`src/main/platform/*`, the renderer and the saver): kept thin, and
    covered by the manual scenarios in [quickstart.md](./quickstart.md). Tray menus can't be
    driven by Playwright, so the menu is tested as the pure `menuModel()` function plus a test
    of the `toElectronMenu()` mapping.
- **Rationale**: Fast, headless, offline tests with zero extra packages, as Principles I and II
  ask.
- **Alternatives considered**:
  - **Vitest or Jest**: a dependency the built-in runner makes unnecessary.
  - **Playwright `_electron`**: can't open tray menus, so it adds little here.

## R11. Google client library (owner request: "use Google client library if possible")

- **Finding** (checked on npm, 2026-10-27):
  - **`googleapis` 188.0.0** (246 MB unpacked) bundles 338 generated API clients, but **none for
    Google Photos**: neither the Library API nor the Picker API.
  - There is no standalone `@googleapis/photospicker` or `@googleapis/photoslibrary` package.
  - A generated client for fetching the user's photos is therefore **not possible**.
- **Decision**: Use Google's official **`google-auth-library` 11.3.1** (0.8 MB, Node ≥ 22) as the
  client for all Google traffic:
  - **OAuth**: R4.
  - **Picker REST calls and photo downloads**: `oauth2Client.request<T>({url, method, data,
    params, responseType})`. This adds `Authorization: Bearer`, refreshes the token before
    expiry, and refreshes then retries once on 401 or 403.
  - **Retries**: gaxios `retryConfig: {retry: 4, retryDelay: 1000, retryDelayMultiplier: 2,
    statusCodesToRetry: [[429, 429], [500, 599]], httpMethodsToRetry: ['GET', 'POST',
    'DELETE']}`. That is 5 tries with backoff of 1 s, 2 s, 4 s and 8 s. This replaces the
    hand-written retry helper.
  - **Testability**: create the client with
    `transporter: new Gaxios({fetchImplementation: fakeFetch})`. Tests exercise the real library
    against recorded fixtures, and no request reaches the network. Tests pass `retryDelay: 1` so
    they run fast, and check the configured backoff values separately.
- **Rationale**: This follows the owner's request as far as Google's libraries allow. Token
  refresh, the 401 handling and the retry logic become library code instead of app code.
- **Alternatives considered**:
  - **Pulling in `googleapis` anyway, for runtime discovery (`google.discoverAPI`) of the
    Picker API**: 246 MB, an untyped dynamic client, and a network fetch of the discovery
    document. It adds nothing over `OAuth2Client.request()` with typed response models.
  - **Hand-written `fetch` with our own retry helper**: the previous decision, replaced at the
    owner's request.
