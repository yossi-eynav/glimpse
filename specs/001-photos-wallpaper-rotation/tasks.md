---

description: "Task list for Google Photos Wallpaper & Screensaver Rotation (Node.js + Electron)"
---

# Tasks: Google Photos Wallpaper & Screensaver Rotation

**Input**: Design documents from `/specs/001-photos-wallpaper-rotation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (menu-ui, ipc,
google-photos-picker, screensaver-handoff), quickstart.md

**Tests**: REQUIRED. Constitution Principle I (Test-First, NON-NEGOTIABLE) applies:
- Every test task comes before the implementation task it covers.
- Each test MUST be run (`npm test`) and seen failing before its implementation starts.
- No test reaches the network. Google traffic goes through the real `google-auth-library`
  `OAuth2Client`, built with `transporter: new Gaxios({fetchImplementation: fakeFetch})`
  (research R11).

**Organization**: Tasks are grouped by user story, so each story can be built and checked as
its own increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1, US2, US3)

## Conventions

- **Behavior** lives in `src/core/**`. It has **no** `electron` imports, and every dependency is
  passed in as an argument.
- **Electron wiring** lives in `src/main/**`, `src/preload/**` and `src/renderer/**`.
- **Tests**: `tests/**/*.test.ts`, using `node:test` and `node:assert/strict`, run directly with
  Node 24 type stripping.
- **TypeScript rules**: only erasable syntax (no `enum`, `namespace` or parameter properties),
  and relative imports keep their `.ts` extension.
- **Commands**: `npm test` = `node --test "tests/**/*.test.ts"`, and
  `npm run typecheck` = `tsc --noEmit`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Remove the leftovers from the Swift plan, set up the npm project, and run the two
spikes that can change the scope.

- [X] T001 Delete the leftovers from the earlier Swift plan: `Core/`, `project.yml`, `Config/`,
  `App/`, `Saver/` and `UITests/`, all at the repository root. Check each one first. The disk is
  case-insensitive, so `Saver/` must be gone before `saver/` is created. Keep `scripts/`, and
  keep `specs/`.
- [X] T002 Create `package.json`:
  - `"type": "module"`, `"main": "dist/main/main.js"`, `"engines": {"node": ">=24"}`
  - **dependencies**: `electron@45`, `google-auth-library@11.3.1`, `wallpaper@7.3.1`
  - **devDependencies**: `typescript@7`, `@types/node@24`, `@electron-forge/cli@8`,
    `@electron-forge/maker-zip@8`, `@electron-forge/maker-dmg@8`
  - **scripts**:
    - `build`: `tsc -p tsconfig.json && node scripts/copy-static.js`
    - `start`: `npm run build && electron-forge start`
    - `test`: `node --test "tests/**/*.test.ts"`
    - `typecheck`: `tsc --noEmit`
    - `build:saver`: `bash scripts/build-saver.sh`
    - `make`: `npm run build && npm run build:saver && electron-forge make --arch=universal`

  Then run `npm install`.
- [X] T003 Create `tsconfig.json`:
  - `strict: true`, `target: "es2024"`, `module: "nodenext"`, `moduleResolution: "nodenext"`
  - `erasableSyntaxOnly: true`, `allowImportingTsExtensions: true`,
    `rewriteRelativeImportExtensions: true`, `verbatimModuleSyntax: true`
  - `rootDir: "src"`, `outDir: "dist"`, with `include: ["src"]`
  - Add `tsconfig.test.json`, which extends it with `noEmit: true` and
    `include: ["src", "tests"]`, and make `typecheck` run `tsc -p tsconfig.test.json`.
- [X] T004 [P] Create `scripts/copy-static.js`, a Node ESM script that copies
  `src/renderer/**/*.{html,css}` to the same paths under `dist/renderer/`.
- [X] T005 [P] Create `forge.config.js` (ESM):
  - `packagerConfig.extendInfo: {LSUIElement: true}`
  - `packagerConfig.asar: {unpack: "**/node_modules/wallpaper/source/macos-wallpaper"}`
  - `packagerConfig.extraResource: ["build/PhotoWallpaperSaver.saver", "config/google.json"]`
  - `packagerConfig.appBundleId: "com.example.photowallpaper"`
  - `packagerConfig.osxSign: {}` and `packagerConfig.osxNotarize`, read from the env vars
    `APPLE_TEAM_ID` and `NOTARY_KEYCHAIN_PROFILE`, and only when they are set
  - makers: zip and dmg for darwin
- [X] T006 [P] Create `config/google.example.json` with `{"clientId": "", "clientSecret": ""}`.
  Write a root `.gitignore` containing:
  - `node_modules/`, `dist/`, `out/`, `build/`
  - `config/google.json`
  - `.DS_Store`, `*.log`
- [X] T007 [P] Add tray icons `assets/trayTemplate.png` (16×16) and `assets/trayTemplate@2x.png`
  (32×32). They are black on transparent, so macOS can tint them as template images: a simple
  photo-frame glyph.
- [X] T008 Create a smoke test `tests/smoke.test.ts` that asserts `1 + 1 === 2`. Run `npm test`
  and `npm run typecheck` to prove the toolchain works, then delete the smoke test.
- [ ] T009 SPIKE R2 (manual, needs a person): follow quickstart scenario 4. In Google's picker,
  open an album with more than 100 photos and check whether every item can be selected in one
  action. Record the outcome under R2 in `specs/001-photos-wallpaper-rotation/research.md`.
  **If it isn't possible, stop before T049 and run `/speckit-clarify` on FR-007.**
- [ ] T010 SPIKE R6:
  1. Write a throwaway `ScreenSaverView` that draws
     `~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper/current.jpg`.
  2. Build it with `swiftc` only, with no Xcode, into a `.saver` bundle.
  3. Ad-hoc sign it and install it in `~/Library/Screen Savers/`.
  4. Check that it loads and shows the image on this Mac (macOS 27). Check macOS 14 too, if one
     is available.

  Record the exact build command and the outcome under R6 in
  `specs/001-photos-wallpaper-rotation/research.md`, then delete the spike files. **If it
  fails, stop before Phase 4.**

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared state model, the fakes, and the Google client factory that every story
uses.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T011 [P] Create the test helper `tests/support/fake-fetch.ts`. `createFakeFetch(routes)`
  returns `{fetch, calls}`:
  - each route is `{method, url: string | RegExp, respond: (req) => Response | Promise<Response>}`
  - `calls` records `{method, url, headers, body}`
  - an unmatched request throws `Error('unexpected request …')`
  - it also exports `jsonResponse(status, body)` and `bytesResponse(status, bytes)`
- [X] T012 [P] Write `tests/core/rotation/clock.test.ts` for `ManualClock`:
  - `now()` returns the start value
  - `advance(ms)` adds to it
  - `sleep(ms)` moves `now()` forward by `ms` and resolves at once
  - `sleeps` records each requested duration
- [X] T013 [P] Implement `src/core/rotation/clock.ts`. Makes T012 pass.
  - Export the type `Clock = {now(): number; sleep(ms: number): Promise<void>}`.
  - Export `systemClock`, which uses `Date.now` and the promise `setTimeout`.
  - Export `ManualClock`, a class with explicitly declared fields (no parameter properties).
- [X] T014 [P] Write `tests/core/persistence/fs.test.ts`. Run the same tests against
  `MemoryFileSystem` and against `NodeFileSystem` (in a `fs.mkdtemp` temp folder):
  - `writeAtomic` (writes `<path>.tmp`, then renames), `read`, `remove` (missing is OK),
    `exists`, `list(dir)`, `copy(from, to)`
  - `freeBytes()`
  - `MemoryFileSystem.writeLog` records the order of writes
- [X] T015 [P] Implement `src/core/persistence/fs.ts`. Makes T014 pass.
  - The `FileSystem` type.
  - `NodeFileSystem`, using `node:fs/promises`, with `freeBytes` computed as
    `fs.statfs(dir).bavail * bsize`.
  - `MemoryFileSystem`, a `Map<string, Uint8Array>` plus `writeLog` and a settable `freeBytes`.
- [X] T016 Write `tests/core/persistence/state-file.test.ts`. Cover:
  - `loadState()` returns `defaultState()` when `state.json` is missing, and also when it is
    corrupt JSON
  - `saveState()` and then `loadState()` round-trip
  - the default `settings.intervalMinutes` is `30`, `useForScreensaver` is `false`, and
    `startAtLogin` is `false`
  - the default `rotation.mode` is `'stopped'`
  - the default `account.status` is `'signedOut'`
  - the saved JSON never contains the keys `accessToken`, `refreshToken` or `access_token`
- [X] T017 Implement `src/core/persistence/app-state.ts` and `src/core/persistence/state-file.ts`.
  Makes T016 pass.

  `app-state.ts` defines the types, with fields exactly as in data-model.md:
  - `AccountConnection`: `status: 'signedOut' | 'signedIn' | 'needsReauth'`,
    `email: string | null`
  - `SelectedPhoto`: `id`, `createdAt: number | null`, `width`, `height`,
    `status: 'pending' | 'saved' | 'unavailable'`, `addedAt`
  - `Selection`: `photos`, `skippedNonPhotoCount`
  - `RotationSettings`: `intervalMinutes` (integer, 1 ≤ value ≤ 10080, default 30),
    `useForScreensaver`, `startAtLogin`
  - `RotationState`:
    `mode: 'stopped' | 'running' | 'paused' | 'pausedExternalChange' | 'blockedNoPhotos'`,
    `currentPhotoId`, `shownThisRound: string[]`, `nextChangeAt: number | null`
  - `AppState`
  - helper functions `defaultState()` and `availableCount(selection)`

  `state-file.ts` defines `loadState(fs, dir)` and `saveState(fs, dir, state)`, using
  `writeAtomic` to `state.json`.
- [X] T018 [P] Write `tests/core/auth/token-store.test.ts`, using a fake `SecretBox` that does
  base64 "encryption". Cover:
  - `save(tokens)` writes `tokens.bin` containing the encrypted JSON
  - `load()` returns the tokens, or `null` when the file is missing or can't be decrypted
  - `clear()` removes the file
  - `merge(newTokens)` keeps the existing `refresh_token` when the new one has none
- [X] T019 [P] Implement `src/core/auth/token-store.ts`. Makes T018 pass.
  - Export the type `SecretBox = {encrypt(s: string): Uint8Array; decrypt(b: Uint8Array): string}`.
  - Export `TokenStore`, which works on Google `Credentials` objects (`access_token`,
    `refresh_token`, `expiry_date`, `id_token`).
- [X] T020 Write `tests/core/auth/google-client.test.ts`. `createGoogleClient({clientId,
  clientSecret, redirectUri, fetch, retryDelayMs})` must return a real `OAuth2Client` that:
  - uses the injected fetch, checked by calling `request()` against a `fake-fetch` route and
    seeing it recorded
  - sends `Authorization: Bearer <token>` after `setCredentials`
  - **retries**: on two 503 responses followed by a 200, makes 3 calls and resolves.
    `retryConfig` equals `{retry: 4, retryDelayMultiplier: 2, statusCodesToRetry: [[429, 429],
    [500, 599]], httpMethodsToRetry: ['GET', 'POST', 'DELETE']}`, with
    `retryDelay = retryDelayMs`, which is 1000 in production and 1 in tests
  - **refresh on 401**: a 401 followed by a token-endpoint refresh and a 200 leads to exactly
    one refresh call
  - emits `tokens` after a refresh
- [X] T021 Implement `src/core/auth/google-client.ts`. Makes T020 pass.
  - Construct `new OAuth2Client({clientId, clientSecret, redirectUri,
    eagerRefreshThresholdMillis: 60000, transporter: new Gaxios({fetchImplementation: fetch})})`.
  - Export `GOOGLE_RETRY_CONFIG(retryDelayMs)`.
  - Export `authorizedRequest<T>(client, opts)`, which merges in `retryConfig`.
  - Import `gaxios` as a direct dependency. Add `gaxios` to `package.json` dependencies, at the
    same major version `google-auth-library` uses (`^8`).

**Checkpoint**: The foundation is ready. `npm test` and `npm run typecheck` pass offline.

---

## Phase 3: User Story 1 - Sign in and rotate the wallpaper from the menu bar (Priority: P1) 🎯 MVP

**Goal**: A tray-only app. The signed-out menu offers only sign-in. After sign-in, the user
picks photos through the selection window and Google's picker, chooses an interval, and starts
rotation. The wallpaper then shuffles across all screens, with no repeats within a round.

**Independent Test**: Quickstart scenarios 1–8.

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T022 [P] [US1] Create fixtures in `tests/fixtures/`:
  - `oauth_token.json` (`access_token`, `expires_in` 3599, `refresh_token`, `id_token` whose
    payload has `"email": "test@example.com"`, `token_type` Bearer)
  - `oauth_refresh.json`
  - `oauth_invalid_grant.json` (`{"error": "invalid_grant"}`)
  - `picker_create_session.json` (`id`, `pickerUri`,
    `pollingConfig {pollInterval: "5s", timeoutIn: "1800s"}`, `expireTime`)
  - `picker_session_pending.json` (`mediaItemsSet: false`)
  - `picker_session_set.json` (`mediaItemsSet: true`)
  - `picker_media_page1.json` (3 items, `nextPageToken: "p2"`)
  - `picker_media_page2.json` (2 items, no token)

    Across both pages that makes 4 `PHOTO` items with `image/jpeg` and 1 `VIDEO`. Field names
    follow contracts/google-photos-picker.md.
  - `sample.jpg`: a valid JPEG under 5 KB, starting `FF D8 FF`
- [X] T023 [P] [US1] Write `tests/main/loopback-server.test.ts` for
  `startLoopbackServer({timeoutMs})`. It returns `{redirectUri, waitForCode(state)}`. Cover:
  - it listens on `127.0.0.1` on an ephemeral port
  - a `GET /?code=abc&state=s1` resolves `'abc'` and responds with HTML containing
    "You can close this tab"
  - a `state` mismatch rejects with `StateMismatch`
  - `?error=access_denied` rejects with `AuthDenied`
  - with no request before `timeoutMs`, it rejects with `Timeout`
  - the server closes after one request
- [X] T024 [P] [US1] Write `tests/core/auth/sign-in.test.ts` for `signIn(deps)`, using the real
  client from `createGoogleClient` with fake fetch, plus a fake loopback and a fake
  `openExternal`. Cover:
  - `openExternal` gets a URL on `accounts.google.com/o/oauth2/v2/auth` containing
    `code_challenge_method=S256`, `access_type=offline`, the scope
    `https://www.googleapis.com/auth/photospicker.mediaitems.readonly openid email`, the
    loopback `redirect_uri`, and a random `state`
  - the token POST body includes `code_verifier`
  - the tokens are saved through `TokenStore`
  - it returns `{status: 'signedIn', email: 'test@example.com'}`, with the email decoded from the
    `id_token`
  - a loopback rejection returns an error and leaves the state signed out
- [X] T025 [P] [US1] Write `tests/core/picker/models.test.ts` for `filterStillPhotos(items)`:
  - only `type === 'PHOTO'` with `mediaFile.mimeType` starting with `image/` is kept
  - the page 1 and page 2 fixtures give 4 photos and `skippedNonPhotoCount === 1` (FR-009)
  - `parseDuration('5s') === 5000`
- [X] T026 [P] [US1] Write `tests/core/picker/picker-client.test.ts` for
  `createPickerClient({client, clock, openExternal})`, using the real `OAuth2Client` with fake
  fetch and `ManualClock`. Cover:
  - `createSession()` POSTs `{}` to `https://photospicker.googleapis.com/v1/sessions` with a
    Bearer token
  - `open(session)` calls `openExternal(pickerUri + '/autoclose')`
  - `waitUntilPicked(session, signal)` polls `GET /v1/sessions/{id}` and sleeps
    `pollInterval` (5000 ms) between polls, until `mediaItemsSet`
  - it returns `'timedOut'` once the elapsed `ManualClock` time passes `timeoutIn`
  - an aborted `signal` returns `'cancelled'` and sends `DELETE /v1/sessions/{id}`
  - `listMediaItems(id)` follows `nextPageToken` with `pageSize=100`
  - `deleteSession(id)` sends `DELETE`
  - `invalid_grant` on refresh rejects with `NeedsReauth`
- [X] T027 [P] [US1] Write `tests/core/library/downloader.test.ts` for
  `createDownloader({client, fs, dir, concurrency: 4, minFreeBytes: 1_000_000_000})`, using fake
  fetch. Cover:
  - **requests**: `downloadAll(items, {width: 3024, height: 1964})` requests
    `{baseUrl}=w3024-h1964` and `{baseUrl}=w256-h256-c`, through the client, with a Bearer token
  - **files written**: `Photos/{id}.jpg` and `Thumbs/{id}.jpg`
  - **status updates**: reports `{id, status: 'saved'}` for each success, through an `onUpdate`
    callback. After the retries are used up, it reports `'unavailable'`. When the fetch throws a
    network error, the photo stays `'pending'`
  - **concurrency**: no more than 4 downloads are in flight at once, checked with fake-fetch
    responses that are held until released
  - **low disk space**: when `fs.freeBytes() < minFreeBytes`, it stops starting new downloads and
    calls `onLowDisk()`
- [X] T028 [P] [US1] Write `tests/core/library/selection-draft.test.ts` for
  `SelectionDraft.from(selection)`. Cover:
  - `addPicked(photos, skipped)` skips IDs that are already present, and new photos get status
    `'pending'` and `addedAt = clock.now()`
  - `remove(id)` and `clear()` change only the draft
  - `commit()` returns `{selection, removedIds}`
  - `discard()` leaves the original selection unchanged
  - `view()` returns a `DraftView` (contracts/ipc.md)

  Also write `tests/core/library/photo-store.test.ts`:
  - `deletePhotos(ids)` removes `Photos/{id}.jpg` and `Thumbs/{id}.jpg` (FR-011)
  - `isValidJpeg(id)` is true only when the file exists and starts with `FF D8 FF`
- [X] T029 [P] [US1] Write `tests/core/rotation/shuffle.test.ts` for
  `pickNext(state, selection, random)`, with a seeded `random`. Cover:
  - N saved photos picked N times gives each photo exactly once (SC-006)
  - after that, a new round starts, and its first pick isn't `currentPhotoId` when N > 1
  - a single saved photo is always returned
  - only `status === 'saved'` photos are candidates
  - it returns `null` when there are none
- [X] T030 [P] [US1] Write `tests/core/wallpaper/desktop.test.ts`, using `FakeDesktop`
  (`set(path)`, `get(): Promise<string[]>`, `calls`). `applyPhoto(desktop, photosDir, id)` must
  call `set` with `<photosDir>/<id>.jpg`. The real adapter's options (`screen: 'all'`,
  `scale: 'fill'`) are asserted in T047's test.
- [X] T031 [P] [US1] Write `tests/core/rotation/engine.test.ts` for
  `createRotationEngine({state, clock, desktop, fs, dirs, random, save, isValidJpeg})`. Cover:
  - **start**: `start()` with `availableCount > 0` sets the wallpaper at once, sets
    `mode = 'running'`, and sets `nextChangeAt = now + intervalMinutes * 60000`. With 0
    available, it does nothing
  - **tick**: `tick()` before `nextChangeAt` does nothing. After it, the photo changes and
    `nextChangeAt` is reset
  - **interval**: `setInterval(m)` (validated 1–10080) sets `nextChangeAt = now + m * 60000`
  - **no photos left**: `mode = 'blockedNoPhotos'`, and the wallpaper isn't changed
  - **displays changed**: `displaysChanged()` re-applies the current photo
  - **saving and listeners**: `save` is called after every state change, and `onChange`
    listeners are notified
- [X] T032 [P] [US1] Write `tests/core/rotation/custom-interval.test.ts` for
  `toMinutes(value, unit)` and `validateInterval(value, unit)`:
  - `(90, 'minutes')` is OK, `(2, 'hours')` is 120, and `(7, 'days')` is 10080, which is OK
  - `(0, 'minutes')`, `(-1, …)`, `(1.5, 'minutes')` and `(8, 'days')` all return
    `{ok: false, hint: 'Between 1 minute and 7 days'}`
- [X] T033 [P] [US1] Write `tests/core/menu/menu-model.test.ts` for the US1 items, per
  contracts/menu-ui.md:
  - **signed out**: `menuModel(state)` returns exactly `[action signIn 'Sign in with Google',
    action quit 'Quit']` (FR-002)
  - **signed in**, in this order:
    - the status label and `'<N> photos selected'`
    - a separator, then `chooseImages` "Choose Google Photos images…"
    - the `Change every` submenu: radio items `interval:5`, `:15`, `:30`, `:60`, `:360` and
      `:1440`, labelled 5 min, 15 min, 30 min, 1 hour, 6 hours, 1 day, with the current one
      checked; then a separator and `customInterval` "Custom…"
    - `start` "Start rotation", then `next` "Next photo"; both disabled when N = 0
    - a separator, the `email` label, and `quit`
  - **custom interval**: when it isn't a preset, a checked `Custom (<n> min)` item appears above
    `Custom…`
  - **status text**: `'Rotation stopped'`; `'Next change at HH:mm'` (24-hour, local);
    `'Next change <Ddd> HH:mm'` when it isn't today. Use a fixed `now` and `timeZone: 'UTC'`
- [X] T034 [P] [US1] Write `tests/main/tray.test.ts` for `toElectronMenu(items, onClick)`:
  - each `action` maps to `{label, enabled, click}`
  - `toggle` maps to `type: 'checkbox'`
  - a radio inside a submenu maps to `type: 'radio'`
  - `separator` maps to `{type: 'separator'}`
  - `label` maps to `{label, enabled: false}`
  - `click` calls `onClick(id)`

  Only `import type` from `electron` is allowed, so the test runs under plain Node.

### Implementation for User Story 1

- [X] T035 [US1] Implement `src/main/platform/loopback-server.ts` (`node:http`; no electron
  import). Makes T023 pass.
- [X] T036 [US1] Implement `src/core/auth/sign-in.ts`. Makes T024 pass.
  - `client.generateCodeVerifierAsync()`
  - `client.generateAuthUrl({access_type: 'offline', prompt: 'consent', scope,
    code_challenge_method: CodeChallengeMethod.S256, code_challenge, state, redirect_uri})`
  - `openExternal(url)`, then `waitForCode(state)`
  - `client.getToken({code, codeVerifier, redirect_uri})`, then `setCredentials`
  - `tokenStore.save`
  - decode the `id_token` payload to get the email
  - subscribe `client.on('tokens', t => tokenStore.merge(t))`
- [X] T037 [P] [US1] Implement `src/core/picker/models.ts`. Makes T025 pass.
  - The types `PickerSession`, `PollingConfig`, `PickedMediaItem` and `MediaFile`.
  - `filterStillPhotos`.
  - `parseDuration`.
- [X] T038 [US1] Implement `src/core/picker/picker-client.ts`, using `authorizedRequest` from
  `google-client.ts`. Makes T026 pass.
  - It throws a `NeedsReauth` error class when there is a `GaxiosError` with
    `response.data.error === 'invalid_grant'`.
- [X] T039 [US1] Implement `src/core/library/downloader.ts`: a promise pool of 4, using
  `authorizedRequest` with `responseType: 'arraybuffer'`, and the free-space check before each
  download. Makes T027 pass.
- [X] T040 [US1] Implement `src/core/library/selection-draft.ts` and
  `src/core/library/photo-store.ts`. Makes T028 pass.
- [X] T041 [P] [US1] Implement `src/core/rotation/shuffle.ts`, following steps 1–3 of "Choosing
  the next photo" in data-model.md. Makes T029 pass.
- [X] T042 [P] [US1] Implement `src/core/wallpaper/desktop.ts`: the `Desktop` type, `FakeDesktop`
  (exported for tests) and `applyPhoto`. Makes T030 pass.
- [X] T043 [US1] Implement `src/core/rotation/engine.ts`: `start`, `tick`, `setInterval`,
  `displaysChanged`, `getState` and `onChange`. It uses `pickNext`, `applyPhoto`, the
  `isValidJpeg` dependency and `save`. Makes T031 pass.
- [X] T044 [P] [US1] Implement `src/core/rotation/custom-interval.ts`. Makes T032 pass.
- [X] T045 [US1] Implement `src/core/menu/menu-model.ts`: the `MenuItem` union type and
  `menuModel(state, notice, now, timeZone?)`, covering the US1 items. Makes T033 pass.
- [X] T046 [US1] Implement `toElectronMenu` in `src/main/tray.ts`, plus `createTray(onClick)`,
  which uses `assets/trayTemplate.png` and `tray.setContextMenu(Menu.buildFromTemplate(…))` on
  every engine `onChange`. Makes T034 pass.
- [X] T047 [US1] Implement the Electron platform adapters, writing the tests first in
  `tests/main/wallpaper-desktop.test.ts`. Inject the `wallpaper` module as a parameter, so the
  test can pass a fake.
  - `src/main/platform/wallpaper-desktop.ts`:
    - `set(path)` calls `setWallpaper(path, {screen: 'all', scale: 'fill'})`
    - `get()` calls `getWallpaper({screen: 'all'})`
  - `src/main/platform/safe-storage-box.ts`: a `SecretBox` built on `safeStorage.encryptString`
    and `decryptString`.
- [X] T048 [P] [US1] Create the shared types and the selection preload:
  - `src/shared/ipc-types.ts`: `DraftView`, `PickResult` and the channel-name constants, exactly
    as in contracts/ipc.md.
  - `src/preload/selection.ts`: `contextBridge.exposeInMainWorld('selection', {getDraft, pick,
    cancelPick, remove, clearDraft, commit, discard, onDraftChanged})`, using
    `ipcRenderer.invoke` and `on`.
- [X] T049 [US1] Implement the selection window renderer, following the selection-dialog table
  in contracts/menu-ui.md:
  - **Files**: `src/renderer/selection/index.html`, with the CSP meta
    `default-src 'self'; img-src photo:; style-src 'self'`; `src/renderer/selection/selection.ts`;
    and `src/renderer/selection/selection.css`.
  - **Header**: `<N> photos · <k> videos skipped`.
  - **Grid**: `<img src="photo://thumb/{id}">`, with a × button on each.
  - **Buttons**: "Add from Google Photos…", "Clear all" (with `confirm()`), "Cancel" and "Done".
  - **Waiting overlay**: "Finish choosing in your browser…" with a Cancel button.
  - **PickResult messages**: show one for each kind.

  This depends on T009's outcome for the album behavior.
- [X] T050 [US1] Implement `src/main/photo-protocol.ts`:
  `protocol.handle('photo', …)` serves only `photo://thumb/{id}`, where `id` matches
  `^[A-Za-z0-9_-]+$` and is in the current selection or draft. Anything else is a 404. Register
  the scheme as privileged before `app.ready`.
- [X] T051 [US1] Implement `src/main/ipc.ts` and `src/main/windows.ts`:
  - `ipcMain.handle` for every `selection:*` channel in contracts/ipc.md, checking each argument
    (for example, `remove` rejects IDs not in the draft).
  - `pick` runs `pickerClient.createSession`, `open` and `waitUntilPicked`, then
    `listMediaItems`, `filterStillPhotos` and `draft.addPicked`, then `downloader.downloadAll`
    (sending `selection:draftChanged` on updates), then `deleteSession`.
  - `openSelectionWindow()` creates a `BrowserWindow` with `{width: 720, height: 560, minWidth:
    560, minHeight: 420, webPreferences: {preload, contextIsolation: true, sandbox: true,
    nodeIntegration: false}}`. Only one can be open at a time.
- [X] T052 [P] [US1] Implement the custom interval prompt:
  - `src/preload/custom-interval.ts`
  - `src/renderer/custom-interval/index.html` and `src/renderer/custom-interval/custom-interval.ts`:
    a number field and a unit select, with OK disabled and the hint shown when invalid
  - the `interval:*` handlers in `src/main/ipc.ts`, which validate again with
    `validateInterval`
  - `openCustomIntervalWindow()` in `src/main/windows.ts`
- [X] T053 [US1] Implement `src/main/scheduler.ts`: `createScheduler(engine)` holds one
  `setTimeout` until `nextChangeAt`, then calls `engine.tick()`. It reschedules on every engine
  `onChange`, and clears the timer when `nextChangeAt` is `null`.
- [X] T054 [US1] Implement `src/main/system-events.ts` (part 1):
  `screen.on('display-added' | 'display-removed')` calls `engine.displaysChanged()`.
- [X] T055 [US1] Implement `src/main/main.ts`:
  - **Lifecycle**: `app.requestSingleInstanceLock()`, and quit if it isn't granted;
    `app.dock?.hide()`; `window-all-closed` does nothing, so the app doesn't quit.
  - **Config**: load `config/google.json`, from `process.resourcesPath` when packaged or from
    the repo root in development.
  - **Composition**: build `NodeFileSystem` on `app.getPath('userData')`, `loadState`,
    `TokenStore(SafeStorageBox)`, `createGoogleClient` (setting credentials from stored tokens),
    `createPickerClient`, `createDownloader`, `createRotationEngine`, the tray, the scheduler,
    IPC and system events.
  - **Menu handlers**: `signIn`, `chooseImages`, `interval:<m>`, `customInterval`, `start`,
    `next` and `quit`.

**Checkpoint**: US1 is usable with `npm start`. Run quickstart scenarios 1–8.

---

## Phase 4: User Story 2 - Screensaver shows the current photo (Priority: P2)

**Goal**: "Use for screensaver" installs the native saver and opens System Settings. The saver
shows the current wallpaper photo and follows every change.

**Independent Test**: Quickstart scenarios 9–10.

**Depends on**: US1 (engine change events), and spike T010 having succeeded.

### Tests for User Story 2 ⚠️ write first, confirm they fail

- [X] T056 [P] [US2] Write `tests/core/screensaver/handoff.test.ts` for
  `createHandoffWriter({fs, dir, clock})`, using `MemoryFileSystem`. Cover:
  - `publish(photoPath, id)` writes `current.jpg` (a copy of the photo), then `manifest.json`
    through `writeAtomic`, in that order according to `writeLog`
  - the manifest is exactly `{"version": 1, "photoId": "<id>", "updatedAt": "<ISO-8601>",
    "enabled": true}`
  - `disable()` writes the manifest with `"enabled": false`
  - `dir` defaults to
    `~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper/`
- [X] T057 [P] [US2] Write `tests/core/screensaver/installer.test.ts` for
  `installSaver({fs, bundledPath, home, openExternal})`:
  - it removes any existing `~/Library/Screen Savers/PhotoWallpaperSaver.saver`, then copies the
    bundled one there
  - it calls `openExternal('x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension')`
- [X] T058 [P] [US2] Extend `tests/core/rotation/engine.test.ts`:
  - with `useForScreensaver` on, each photo change calls `handoff.publish` with the current photo
  - `setUseForScreensaver(false)` calls `handoff.disable()` and stops publishing
- [X] T059 [P] [US2] Extend `tests/core/menu/menu-model.test.ts`: the signed-in menu has a
  `toggleScreensaver` checkbox "Use for screensaver", reflecting `useForScreensaver`, after a
  separator that follows `next`.

### Implementation for User Story 2

- [X] T060 [P] [US2] Implement `src/core/screensaver/handoff.ts`. Makes T056 pass.
- [X] T061 [P] [US2] Implement `src/core/screensaver/installer.ts`. Makes T057 pass.
- [X] T062 [US2] Add the `handoff` dependency and `setUseForScreensaver(on)` to
  `src/core/rotation/engine.ts`, and add the toggle to `src/core/menu/menu-model.ts`. Makes T058
  and T059 pass.
- [X] T063 [US2] Implement the saver:
  - **`saver/PhotoWallpaperSaverView.swift`**: an `@objc(PhotoWallpaperSaverView)` subclass of
    `ScreenSaverView`.
    - `animationTimeInterval = 1.0`.
    - `animateOneFrame` reads `manifest.json`, and reloads `current.jpg` only when `photoId`
      changes.
    - It draws aspect-fill, centered, with a 0.5 s crossfade.
    - When `enabled == false`, it shows black and "Google Photos Wallpaper is turned off in the
      menu".
    - When files are missing or invalid, or the `version` is unknown, it shows black, and never
      crashes.
  - **`saver/Info.plist`**: `NSPrincipalClass` is `PhotoWallpaperSaverView`, `CFBundleName` is
    "Google Photos Wallpaper", and the bundle ID is `com.example.photowallpaper.saver`.
  - **`scripts/build-saver.sh`**: the `swiftc` command recorded by spike T010. It writes
    `build/PhotoWallpaperSaver.saver/Contents/{MacOS,Info.plist}` and signs it ad-hoc (or with
    `$DEVELOPER_ID` when set).
- [X] T064 [US2] Wire the `toggleScreensaver` handler in `src/main/main.ts`:
  - **on**: `installSaver` (with `bundledPath` from `process.resourcesPath` when packaged, or
    `build/` in development), then `engine.setUseForScreensaver(true)`, then
    `dialog.showMessageBox` with "Select 'Google Photos Wallpaper' in Screen Saver settings"
    (FR-021)
  - **off**: `engine.setUseForScreensaver(false)`

**Checkpoint**: US1 and US2 work. Run quickstart scenarios 9–10.

---

## Phase 5: User Story 3 - Control and keep the rotation running from the menu (Priority: P3)

**Goal**: Pause, Resume and Next photo, changing the interval, editing the selection without
resetting the round, start at login, sign out, and restoring the state after a restart, a reboot
or sleep.

**Independent Test**: Quickstart scenarios 11, 12 and 15.

**Depends on**: US1. Independent of US2.

### Tests for User Story 3 ⚠️ write first, confirm they fail

- [X] T065 [P] [US3] Extend `tests/core/rotation/engine.test.ts`. Cover:
  - **pause**: `pause()` sets `mode = 'paused'` and clears `nextChangeAt`. A later `tick()`
    doesn't change the photo
  - **resume**: `resume()` sets `'running'` with `nextChangeAt = now + interval`
  - **next**: `next()` changes the photo at once, from running or paused, and sets
    `nextChangeAt = now + interval`
  - **editing the selection**: `selectionChanged(newSelection)` removes deleted IDs from
    `shownThisRound` and keeps the others (data-model step 4)
  - **sleep**: after `clock.advance(5 × interval)`, a single `tick()` makes exactly one change
    (FR-017)
  - **launch**: `restore()` with a saved `'running'` state and an overdue `nextChangeAt` makes
    one change. A saved `'paused'` state stays paused
- [X] T066 [P] [US3] Write `tests/core/auth/sign-out.test.ts` for `signOut(deps)`, using fake
  fetch for the revoke call, `MemoryFileSystem` and the fake `SecretBox`. It must:
  - set `mode = 'stopped'`
  - delete every `Photos/*` and `Thumbs/*` file
  - empty `selection.photos`
  - clear `tokens.bin`
  - send `POST https://oauth2.googleapis.com/revoke` through `client.revokeToken`
  - set `account = {status: 'signedOut', email: null}`

  If the revoke call returns 500 or throws, the local cleanup must still finish.
- [X] T067 [P] [US3] Write `tests/main/login-item.test.ts` for `createLoginItem(appLike)`, using a
  fake that has `setLoginItemSettings` and `getLoginItemSettings`:
  - `setEnabled(true)` calls `setLoginItemSettings({openAtLogin: true})`
  - `isEnabled()` reads `openAtLogin`
- [X] T068 [P] [US3] Extend `tests/core/menu/menu-model.test.ts`. Cover:
  - **the start item**: `start` "Start rotation" for `stopped` and `blockedNoPhotos`; `pause`
    "Pause" for `running`; `resume` "Resume" for `paused` and `pausedExternalChange`
  - **toggles and account**: the `toggleLogin` checkbox "Start at login"; `signOut` "Sign out"
    after the email label
  - **status text**: `'Paused'`, `'Paused — wallpaper changed in System Settings'` and
    `'Stopped — no photos available'`
  - the **full** signed-in order matches contracts/menu-ui.md exactly

### Implementation for User Story 3

- [X] T069 [US3] Add `pause`, `resume`, `next`, `selectionChanged` and `restore` to
  `src/core/rotation/engine.ts`. Makes T065 pass.
- [X] T070 [P] [US3] Implement `src/core/auth/sign-out.ts`. Makes T066 pass.
- [X] T071 [P] [US3] Implement `src/main/platform/login-item.ts`. Makes T067 pass.
- [X] T072 [US3] Extend `src/core/menu/menu-model.ts` with the start/pause/resume item,
  `toggleLogin`, `signOut` and the remaining status texts. Makes T068 pass.
- [X] T073 [US3] Wire the US3 behavior:
  - **`src/main/main.ts`**: the `pause`, `resume`, `next`, `toggleLogin` and `signOut` handlers;
    syncing `settings.startAtLogin` from `getLoginItemSettings()` on launch; and calling
    `engine.restore()` after the state loads.
  - **`src/main/system-events.ts`**: `powerMonitor.on('resume', () => engine.tick())`.
  - **`src/main/ipc.ts`**: `selection:commit` calls `photoStore.deletePhotos(removedIds)` and then
    `engine.selectionChanged(selection)`.
  - **Opening the dialog**: the draft starts from the saved selection (US3 scenario 4).

**Checkpoint**: All stories work. Run quickstart scenarios 11, 12 and 15.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Notices, detecting manual wallpaper changes, unavailable photos, privacy, idle CPU,
packaging and docs.

- [X] T074 [P] Write `tests/core/rotation/external-change.test.ts`:
  - when `FakeDesktop.get()` returns a path outside the `Photos/` folder on any screen before a
    scheduled change, `tick()` sets `mode = 'pausedExternalChange'` and doesn't set the
    wallpaper (FR-018)
  - paths inside `Photos/` are ignored
- [X] T075 Implement the external-change check in `src/core/rotation/engine.ts`, called at the
  start of `tick()`. Makes T074 pass.
- [X] T076 [P] Write `tests/core/rotation/unavailable.test.ts`:
  - when the next pick's file fails `isValidJpeg`, it is marked `'unavailable'`, another photo
    is picked in the same `tick()`, and rotation continues (FR-024)
  - when every photo is unavailable, the mode is `'blockedNoPhotos'`
- [X] T077 Implement the check-before-apply loop in `src/core/rotation/engine.ts`, and the dimmed
  thumbnails with a ⚠ badge and the pending spinner in `src/renderer/selection/selection.ts` and
  `src/renderer/selection/selection.css`. Makes T076 pass.
- [X] T078 [P] Write `tests/core/menu/notice.test.ts` for `currentNotice({state, isOnline,
  lowDisk})`, following the priority table in contracts/menu-ui.md:
  - `needsReauth` gives "Sign in again to change your photos" with action `signIn`. It beats low
    disk, which beats offline with pending photos ("Offline — <k> photos waiting to download"),
    which beats "<k> photos unavailable" with action `chooseImages`
  - `null` when nothing applies
  - `menuModel` puts the notice first
  - with `needsReauth`, the `chooseImages` handler triggers sign-in first
- [X] T079 Implement `src/core/menu/notice.ts` and add it to `menuModel`. In `src/main/main.ts`:
  - pass in `net.isOnline`
  - feed `onLowDisk` from the downloader
  - retry `pending` downloads on `tick()` while online
  - set `account.status = 'needsReauth'` on `NeedsReauth` errors

  Makes T078 pass.
- [X] T080 [P] Write `tests/core/auth/no-secrets-in-logs.test.ts`:
  - **sign-in, refresh and a picker session**: run them with fixtures, capturing everything sent
    to the `log` function that `src/core` uses. No `access_token`, `refresh_token`, auth code or
    `client_secret` value may appear in the log output, in `state.json`, or in any `DraftView`
    or `PickResult` sent over IPC (FR-027)
  - **`id_token`**: it can carry the user's email, so that value must not appear in the log
    output either
- [X] T081 Add a `log(level, msg, fields)` dependency to `src/core` modules, with a
  `redact(fields)` helper that drops the keys `access_token`, `refresh_token`, `id_token`,
  `code`, `client_secret` and `Authorization`. Wire it to `console` in `src/main/main.ts`. Makes
  T080 pass.
- [ ] T082 Measure idle CPU against SC-009 (quickstart scenario 16): idle for 30 min with a
  15-minute interval, across all Electron processes, measured with Activity Monitor or
  `top -l`. Record the result in `specs/001-photos-wallpaper-rotation/quickstart.md`. If CPU is
  at 1% or higher, find and remove any timers or renderer activity while idle.
- [X] T083 [P] Write `README.md` covering:
  - what the app does
  - Google Cloud setup (a Desktop app OAuth client, the Picker API, test users)
  - `config/google.json`
  - `npm install`, `npm test`, `npm start`, `npm run build:saver` and `npm run make`
  - signing and notarizing through the env vars `APPLE_TEAM_ID` and `NOTARY_KEYCHAIN_PROFILE`
  - the known Spaces limitation (research R5)
- [ ] T084 Run `npm run make` and install the built app from `out/make/`. Then run every scenario
  in `specs/001-photos-wallpaper-rotation/quickstart.md`, including `npm test` with Wi-Fi off,
  and record pass or fail next to each scenario.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 runs first. T002 and T003 come before T008. T004–T007 are [P]. The
  spikes T009 and T010 are done by a person and can run alongside.
- **Foundational (Phase 2)**: depends on T008. It blocks every story.
- **US1 (Phase 3)**: depends on Phase 2. T049 also waits for spike T009.
- **US2 (Phase 4)**: depends on US1 (the engine, the menu model and `main.ts`) and on spike T010.
- **US3 (Phase 5)**: depends on US1. It doesn't depend on US2, so US2 and US3 can run in parallel
  after US1.
- **Polish (Phase 6)**: depends on US1. T075, T077 and T079 edit `engine.ts`, `menu-model.ts`
  and `main.ts`, so run them after US3.

### Within Each Story

- Write the tests, confirm they fail, then implement until they pass. Each implementation task
  names the tests it makes pass.
- Order: fixtures and pure models, then services (sign-in, picker, downloader, engine), then the
  menu model, then the Electron adapters, preload and renderer, and finally the `main.ts` wiring.
- Tasks that touch the same file (`engine.ts`, `menu-model.ts`, `main.ts`, `ipc.ts`,
  `windows.ts`) are never marked [P] against each other.

### Parallel Opportunities

- **Setup**: T004, T005, T006 and T007.
- **Foundational**: the pairs T011, T012/T013, T014/T015 and T018/T019.
- **US1 tests**: T022–T034 are all [P], each in its own file.
- **US1 implementation**: T037, T041, T042, T044, T048 and T052 can run alongside the
  sequential service chain T035 → T036 → T038 → T039 → T040 → T043.
- **After US1**: US2 (T056–T064) and US3 (T065–T073) can be built at the same time, coordinating
  the edits to `engine.ts`, `menu-model.ts` and `main.ts`.

---

## Parallel Example: User Story 1

```bash
# All US1 tests together (each must fail first):
Task: "T024 sign-in tests in tests/core/auth/sign-in.test.ts"
Task: "T026 picker client tests in tests/core/picker/picker-client.test.ts"
Task: "T029 shuffle tests in tests/core/rotation/shuffle.test.ts"
Task: "T033 menu model tests in tests/core/menu/menu-model.test.ts"

# Independent implementations together:
Task: "T037 picker models in src/core/picker/models.ts"
Task: "T041 shuffle in src/core/rotation/shuffle.ts"
Task: "T042 desktop helpers in src/core/wallpaper/desktop.ts"
Task: "T044 custom interval in src/core/rotation/custom-interval.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1, including both spikes. If the R2 spike fails, amend FR-007 before T049.
2. Phase 2.
3. Phase 3 (US1).
4. **Stop and check**: `npm test` passes offline, then run quickstart scenarios 1–8.

### Incremental Delivery

1. Setup and Foundational, then US1: the MVP, a rotating Google Photos wallpaper from the menu
   bar.
2. Add US2 (screensaver), then run scenarios 9–10.
3. Add US3 (controls, persistence, sign-out), then run scenarios 11, 12 and 15.
4. Polish: notices, manual-change detection, unavailable photos, privacy, idle CPU, packaging.

---

## Notes

- Tests run before their implementation and must be seen failing (Constitution I).
- The runtime dependencies are only `electron`, `google-auth-library` (with its `gaxios`) and
  `wallpaper` (plan.md, Complexity Tracking).
- `src/core` must never import `electron`. A review check:
  `grep -r "from 'electron'" src/core` returns nothing.
- Commit after each test and implementation pair.
- Spikes T009 and T010 can change the scope. Don't skip them.

---

## Implementation Notes (2026-10-27, `/speckit-implement`)

Where the code differs from the task text, and why:

- **T021, gaxios**: imported through `google-auth-library`'s own re-export
  (`import { gaxios } from 'google-auth-library'`), not as a direct dependency. A direct ESM
  import loaded a second copy of gaxios next to the CJS copy the library uses (the dual-package
  hazard), which broke typechecking and would break `instanceof` checks. `createGoogleClient`
  returns `{oauth, request}`, where `request` applies the retry config and maps `invalid_grant`
  to `NeedsReauth`.
- **T021, 401 handling**: added `forceRefreshOnFailure: true`. `OAuth2Client` only refreshes on
  a 401 when the token has no `expiry_date`, and our stored tokens always have one. T020's test
  caught this.
- **T028, discard**: `SelectionDraft.discard()` returns the IDs added in the draft, and
  `commit().removedIds` includes photos that were added and then removed. Both are needed so that
  files downloaded for an abandoned draft get deleted.
- **Added module `src/core/library/selection-session.ts`** (tested in
  `tests/core/library/selection-session.test.ts`). The pick, cancel, commit, discard and
  status-update logic that T051 had placed in `ipc.ts` lives here, so it is tested.
  `retryPending()` (for T079) retries downloads left pending while their 60-minute URLs are
  still valid, marks expired ones `unavailable`, and skips while a batch is still running.
- **T048 and T052, preloads**: `src/preload/*.cjs` are plain CommonJS, because sandboxed
  preloads can't be ES modules. `scripts/copy-static.js` copies them into `dist/`.
- **T050, protocols**: `src/main/protocols.ts` (not `photo-protocol.ts`) registers both
  `photo://thumb/{id}` and `app://renderer/…`. Renderer pages load from `app://` instead of
  `file://`, which avoids ES-module CORS problems with `file://` URLs.
- **T034, tray menu**: `toElectronMenu` lives in `src/main/tray-menu.ts`, which only has a type
  import from Electron, so it is testable under plain Node. `src/main/tray.ts` holds the runtime
  `Tray`.
- **T081, logging**: `src/core/log.ts` (`Log`, `redact`, `consoleLog`) is injected into the
  engine and used in `main.ts`.
- **`package.json` test script**: `--test-timeout=20000`, so a hanging test fails instead of
  stalling the run.

**Amendment A (2026-10-27)**:
- The `wallpaper` npm package is removed. The only runtime dependency is
  `google-auth-library`; Electron is a dev dependency that Forge bundles.
- `pw-helper` is in `native/helper/main.swift`. It's a `@MainActor` class entered from a
  `@MainActor @main` type, and it compiles with no warnings in both Swift 5 and Swift 6 modes.
  It's universal and 230 KB. It answers the protocol, refuses paths outside the photos folder,
  and exits cleanly at end of input; all of this was checked without changing the wallpaper.
- `src/main/platform/helper-desktop.ts` supervises the helper. A race found by T092 is fixed: a
  killed or exited helper is marked not-ready at once, and requests not yet sent wait for the
  restarted helper instead of failing. The helper tests stop every helper in an `after` hook,
  and they passed 5 runs in a row with no orphan processes.
- The engine now keeps the current photo and the round when a wallpaper set fails, and retries
  at the next interval. `stop()` sends `clear` to the helper. `externalChange()` pauses
  rotation.
- T105, the store watcher, is implemented **before** spike T088 has been run. It is safe
  without that confirmation: if `Index.plist` never changes, no events arrive, and the check
  before each scheduled change still applies. If the spike shows false positives, remove the
  `watchStore` call in `native/helper/main.swift`.
- The screensaver moved to `native/saver/`. `scripts/build-native.sh` replaces
  `build-saver.sh`, and the npm script `build:native` replaces `build:saver`.

**Not done (needs a person or a running app):**
- **T009**: the album spike.
- **T010 part 2**: in System Settings, check that the screensaver loads and reads the handoff
  folder. Part 1 passed: the build loads, see research R6.
- **T082**: idle CPU measurement.
- **T084**: `npm run make`, installing the app, and the manual quickstart scenarios.

---

# Amendment A: our own wallpaper helper (`pw-helper`) replaces the `wallpaper` package

**Input**: plan.md (amended 2026-10-27), research.md R5, contracts/wallpaper-helper.md,
data-model.md ("Wallpaper helper"), quickstart.md scenarios 8, 8a–8c and 14.

**Scope**:
- Remove the `wallpaper` npm package.
- Add `pw-helper`, a Swift helper process that stays running, behind the existing core `Desktop`
  interface.
- Re-apply the current photo on every Space switch, which closes the Spaces gap.
- Detect manual wallpaper changes as they happen (FR-018).
- Move the screensaver into `native/` with a shared build script.

**Already true and not repeated here**: the engine, the menu, the selection and sign-out flows
and their 149 tests stay as they are. Phases 1–6 above are complete apart from the manual tasks
T009, T010 (part 2), T082 and T084.

**Tests**: REQUIRED (Constitution I). Every test task comes before its implementation task and
must be seen failing first. No test changes the real wallpaper: the process client is tested
against `tests/support/fake-helper.mjs`, never against `pw-helper`.

---

## Phase 7: Amendment Setup (migration)

**Purpose**: Remove the package and move the native code into one tree. The app must still build
after this phase, with the wallpaper temporarily handled by the old adapter until T097.

- [X] T085 Move `saver/PhotoWallpaperSaverView.swift` and `saver/Info.plist` to
  `native/saver/`, using `git mv` if the project is a repository and `mv` otherwise, then delete
  the empty `saver/` folder. In the header comment of `native/saver/PhotoWallpaperSaverView.swift`,
  keep the reference to `specs/001-photos-wallpaper-rotation/contracts/screensaver-handoff.md`.
- [X] T086 Replace `scripts/build-saver.sh` with `scripts/build-native.sh`.
  - **For now** it builds only the screensaver, from `native/saver/`, with the same `swiftc`,
    `lipo` and `codesign` steps as before.
  - Structure it as a `build_saver` function plus an empty, commented `build_helper` function,
    to be filled in by T095.
  - Delete `scripts/build-saver.sh`.
  - In `package.json`, rename the script `build:saver` to `build:native` (running
    `bash scripts/build-native.sh`), and make `make` run `npm run build:native`.
  - Run `npm run build:native` and check that
    `lipo -archs build/PhotoWallpaperSaver.saver/Contents/MacOS/PhotoWallpaperSaver` prints
    `x86_64 arm64`.
- [X] T087 [P] In `forge.config.js`:
  - remove `asar: { unpack: '**/node_modules/wallpaper/source/macos-wallpaper' }`
  - set `extraResource` to `['build/pw-helper', 'build/PhotoWallpaperSaver.saver', 'config/google.json']`
  - change `saver` to `native` in the `ignore` regex

  Packaging won't work until T095 builds `build/pw-helper`. That's expected.
- [ ] T088 SPIKE R5 (manual, needs a person): follow quickstart scenario 8a.
  1. Run `plutil -p ~/Library/Application\ Support/com.apple.wallpaper/Store/Index.plist > /tmp/before.txt`.
  2. Change the wallpaper in System Settings.
  3. Run the same `plutil` command into `/tmp/after.txt`, then `diff` the two files.
  4. Also run the scratch helper from T095 with `show`, and check whether the file changes then
     too.

  Record both results under R5 in `specs/001-photos-wallpaper-rotation/research.md`. **If the
  file doesn't change on a manual change, skip T105–T106 and keep only the check before each
  scheduled change (research R5 fallback).**

---

## Phase 8: Amendment Foundational (blocking)

**Purpose**: The helper wire protocol and a fake helper, which every later test depends on.

- [X] T089 [P] Write `tests/core/wallpaper/helper-protocol.test.ts` for
  `src/core/wallpaper/helper-protocol.ts`, following contracts/wallpaper-helper.md.
  - **Encoding**: `encodeRequest({id: 1, cmd: 'show', path: '/p/a.jpg'})` returns exactly
    `'{"id":1,"cmd":"show","path":"/p/a.jpg"}\n'`. `get` and `clear` encode without a `path`.
  - **Responses**: `parseLine('{"id":1,"ok":true}')` returns `{type: 'response', id: 1, ok: true}`.
    A failure carries `error`, and `get` responses carry `paths: string[]`.
  - **Events**: `parseLine('{"event":"ready","version":1}')` returns
    `{type: 'event', event: 'ready', version: 1}`. `applied` (`reason: 'space' | 'screens'`,
    `path`) and `externalChange` (`paths`) are parsed the same way.
  - **Rejected input**: `parseLine` returns `{type: 'invalid', reason}` for non-JSON, a missing
    `id`/`event`, an unknown `event`, wrong field types, and lines over 64 KiB.
  - **Line splitting**: a `LineSplitter` turns stdout chunks into complete lines, including a
    line split across two chunks, two lines in one chunk, and a trailing partial line held back.
  - **Versions**: `SUPPORTED_HELPER_VERSION === 1`.
- [X] T090 Implement `src/core/wallpaper/helper-protocol.ts`: the types `HelperRequest`,
  `HelperMessage`, `encodeRequest`, `parseLine`, `LineSplitter` and
  `SUPPORTED_HELPER_VERSION`. Pure TypeScript, erasable syntax only, no `node:` imports beyond
  types. Makes T089 pass.
- [X] T091 [P] Create `tests/support/fake-helper.mjs`, a Node ESM script that speaks the helper
  protocol over stdin/stdout.
  - **On start**: prints `{"event":"ready","version":<FAKE_HELPER_VERSION or 1>}`.
  - **`show`**: answers ok and records the path as the current photo.
  - **`get`**: answers with `paths: [current ?? '/System/Library/CoreServices/DefaultDesktop.heic']`.
  - **`clear`**: answers ok.
  - **Behavior switches** (environment variables, so tests can drive it):
    - `FAKE_HELPER_CRASH_ON=<cmd>`: exit with code 1 on that command.
    - `FAKE_HELPER_SILENT_ON=<cmd>`: never answer that command.
    - `FAKE_HELPER_FAIL_ON=<cmd>`: answer `{ok: false, error: 'boom'}`.
    - `FAKE_HELPER_EMIT_EXTERNAL=1`: emit `externalChange` with
      `paths: ['/Users/x/Pictures/cat.jpg']` 50 ms after the first `show`.
  - **Recording**: appends every received request line to the file named by
    `FAKE_HELPER_LOG`, if set.
  - **Exit**: exits 0 when stdin closes.

**Checkpoint**: `npm test` passes, including the protocol tests.

---

## Phase 9: User Story 1, wallpaper through `pw-helper` on every Space (Priority: P1) 🎯

**Goal**: The rotation sets the wallpaper on every screen through our own helper. Every Space the
user switches to shows the current photo. There is no `wallpaper` package.

**Independent Test**: Quickstart scenarios 5–8 and 8b–8c. Rotation changes the wallpaper on all
displays, each of 3 Spaces shows the current photo within 1 s of switching to it, killing
`pw-helper` recovers on its own, and the idle helper uses about 0% CPU.

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T092 [P] [US1] Write `tests/main/helper-desktop.test.ts` for
  `createHelperDesktop({command, args, env?, log, readyTimeoutMs, requestTimeoutMs, restartDelaysMs, maxRestarts, restartWindowMs})`,
  using `command: process.execPath` and `args: ['tests/support/fake-helper.mjs']`.
  - **Basic round trip**: `start()` resolves after `ready`. `set('/p/a.jpg')` sends `show` and
    resolves. `get()` returns the fake's `paths`. `clear()` sends `clear`. Requests are matched to
    responses by `id`, checked with two `set` calls in flight at once, using `FAKE_HELPER_LOG`.
  - **Errors**:
    - `FAKE_HELPER_FAIL_ON=show` makes `set` reject with `HelperError('boom')`.
    - `FAKE_HELPER_SILENT_ON=get` makes `get` reject with `HelperTimeout` after
      `requestTimeoutMs` (use 200), and the helper is restarted.
    - `FAKE_HELPER_VERSION=2` makes `start()` reject with `HelperIncompatible`, and the process is
      killed.
  - **Crash and restart**: with `FAKE_HELPER_CRASH_ON=get`, `get` rejects with
    `HelperUnavailable`. The client restarts the helper after `restartDelaysMs[0]` (use 20), then
    sends `show` again with the last path passed to `set`, checked in the log of the second
    process. After `maxRestarts` crashes within `restartWindowMs`, the client stops restarting and
    calls `log('error', …)`.
  - **Events**: `onExternalChange(cb)` gets `paths` when the fake emits `externalChange`
    (`FAKE_HELPER_EMIT_EXTERNAL=1`). `applied` events are logged at `info` and not surfaced.
  - **Queueing**: a request made before `ready` is queued and sent once `ready` arrives.
  - **Shutdown**: `stop()` closes stdin, the child exits with code 0, and later requests reject
    with `HelperUnavailable`.
- [X] T093 [P] [US1] Extend `tests/core/rotation/engine.test.ts`:
  - `stop()` calls `desktop.clear()` once, so the helper stops re-applying the photo on Space
    changes
  - when `desktop.set` rejects, `start()` and `tick()` leave `currentPhotoId` and
    `shownThisRound` unchanged, keep `mode = 'running'`, and set
    `nextChangeAt = now + interval`, so the next tick retries; the error is logged at `warn`

  Extend `FakeDesktop` in `src/core/wallpaper/desktop.ts` with `clear()` (which counts the
  `cleared` calls) and a `failNextSet` flag. That edit is test support, so it belongs here.

### Implementation for User Story 1

- [X] T094 [US1] Add `clear?(): Promise<void>` and
  `onExternalChange?(cb: (paths: string[]) => void): () => void` to the `Desktop` type in
  `src/core/wallpaper/desktop.ts`. In `src/core/rotation/engine.ts`:
  - `stop()` calls `await deps.desktop.clear?.()`
  - `changePhoto()` catches a `set` failure, logs it, and reschedules without changing the
    current photo or the round

  Makes T093 pass.
- [X] T095 [US1] Write `native/helper/main.swift` (`pw-helper`), following
  contracts/wallpaper-helper.md:
  - **Arguments**: parse `--photos-dir <path>`, and exit with code 2 if it's missing.
  - **Start-up**: print `{"event":"ready","version":1}` and flush.
  - **Reading stdin**: read on a background `DispatchQueue`, then hop to the main queue for each
    line. Decode with `JSONDecoder` into an enum of `show(path)`, `get` and `clear`. An
    invalid line gets `{"id": <id or null>, "ok": false, "error": "invalid request"}`. Exit 0 at
    end of input.
  - **`show`**: refuse a path that isn't a regular file under the resolved `--photos-dir`
    (`URL.standardizedFileURL`, prefix check including the trailing `/`). For each
    `NSScreen.screens`, call `NSWorkspace.shared.setDesktopImageURL(url, for: screen, options:
    [.imageScaling: NSImageScaling.scaleProportionallyUpOrDown.rawValue, .allowClipping: true])`.
    Set `current = url`, clear `latched`, and record `lastSelfSet = Date()`.
  - **`get`**: `NSScreen.screens.map { NSWorkspace.shared.desktopImageURL(for: $0)?.path ?? "" }`.
  - **`clear`**: set `current = nil`.
  - **Re-apply**: observe `NSWorkspace.shared.notificationCenter`
    `activeSpaceDidChangeNotification` (reason `"space"`) and
    `NotificationCenter.default` `NSApplication.didChangeScreenParametersNotification` (reason
    `"screens"`). If `current != nil && !latched`, set `current` on every screen whose
    `desktopImageURL` differs, update `lastSelfSet`, and emit `applied`.
  - **Output**: write all stdout from the main queue, one line each, with `FileHandle` and
    `synchronize`-free `write`.
  - **Run loop**: run as `NSApplication.shared` with `.prohibited` activation policy (no Dock
    icon, no menu), then `app.run()`.

  The store watcher is added by T105. Keep it under about 200 lines, with no third-party code.
- [X] T096 [US1] Fill in `build_helper` in `scripts/build-native.sh`:
  - build `native/helper/main.swift` for arm64 and x86_64:
    `swiftc -O -parse-as-library -target <arch>-apple-macos14.0 -framework AppKit`, or without
    `-parse-as-library` if `main.swift` uses top-level code
  - `lipo -create` both into `build/pw-helper`
  - sign it with `codesign --force --options runtime --timestamp --sign "$DEVELOPER_ID"` when set,
    otherwise ad-hoc

  Run `npm run build:native`. Check that `lipo -archs build/pw-helper` prints `x86_64 arm64`, and
  that this exits on its own with no wallpaper change:
  `printf '{"id":1,"cmd":"get"}\n' | build/pw-helper --photos-dir /tmp` prints `ready` and then a
  `paths` response.
- [X] T097 [US1] Implement `src/main/platform/helper-desktop.ts` (`node:child_process`; no
  electron import), with:
  - `spawn` with piped stdio and `LineSplitter` from `helper-protocol.ts`
  - a map of pending requests keyed by `id`, each with a timeout
  - queueing until `ready`
  - restart backoff (defaults: `restartDelaysMs: [1000, 2000, 4000, 8000, 16000]`,
    `maxRestarts: 5`, `restartWindowMs: 600000`, `readyTimeoutMs: 5000`,
    `requestTimeoutMs: 5000`), re-sending `show` with the last path after a restart
  - `onExternalChange`
  - `start()` and `stop()`
  - stderr lines logged at `warn`
  - the error classes `HelperError`, `HelperTimeout`, `HelperUnavailable` and
    `HelperIncompatible`

  Implements `Desktop` (`set`, `get`, `clear`, `onExternalChange`). Makes T092 pass.
- [X] T098 [US1] Switch `src/main/main.ts` to the helper:
  - Remove `import * as wallpaper from 'wallpaper'` and `createWallpaperDesktop`.
  - Create
    `const desktop = createHelperDesktop({command: app.isPackaged ? join(process.resourcesPath, 'pw-helper') : join(appDir, 'build', 'pw-helper'), args: ['--photos-dir', photos.photosDir], log: consoleLog})`.
  - `await desktop.start()` before `engine.restore()`. If it fails, show
    `dialog.showErrorBox('Google Photos Wallpaper could not start its wallpaper helper', …)` and
    keep the tray running, so sign-in and selection still work.
  - Pass `desktop` to `createRotationEngine`.
  - Call `desktop.stop()` on `app.on('before-quit')`.
- [X] T099 [US1] Remove the old adapter:
  - delete `src/main/platform/wallpaper-desktop.ts`, and the two `wallpaper desktop …` tests and
    the `createWallpaperDesktop` import in `tests/main/platform-adapters.test.ts`, keeping the
    `safe storage box` tests
  - run `npm uninstall wallpaper`, then check that `grep -rn "wallpaper'" src tests package.json`
    finds no import of the package
  - run `npm test`, `npm run typecheck` and `npm run build`; all must pass
- [ ] T100 [US1] Manual check (needs a person): run `npm run build:native && npm start`, then
  quickstart scenarios 5–8, 8b and 8c. Record the results next to each scenario in
  `specs/001-photos-wallpaper-rotation/quickstart.md`.

**Checkpoint**: the wallpaper rotates through `pw-helper`, every Space shows the current photo,
and the `wallpaper` package is gone.

---

## Phase 10: User Story 2, screensaver from the shared native tree (Priority: P2)

**Goal**: The screensaver builds from `native/saver/` with `build-native.sh`, and installs and
works as before.

**Independent Test**: Quickstart scenarios 9–10.

- [X] T101 [US2] Check the screensaver install path still matches the build output:
  `toggleScreensaver` in `src/main/main.ts` must resolve
  `join(appDir, 'build', 'PhotoWallpaperSaver.saver')` in development and
  `join(process.resourcesPath, 'PhotoWallpaperSaver.saver')` when packaged. Run
  `npm run build:native` and check that `build/PhotoWallpaperSaver.saver` loads, using the
  `Bundle(path:).load()` check from research R6, part 1. No code change is expected; record
  "verified" in the T085–T087 notes.
- [ ] T102 [US2] Manual check (needs a person, also completes T010 part 2): quickstart scenarios
  9–10. Turn on "Use for screensaver", select it in System Settings, start the screensaver,
  confirm it shows the current photo within 2 s, then wait for a change and see the crossfade.
  Record the results under R6 in `specs/001-photos-wallpaper-rotation/research.md`.

**Checkpoint**: US1 and US2 work with the new native layout.

---

## Phase 11: Amendment Polish, instant manual-change detection (FR-018) and docs

**Purpose**: Use the helper's `externalChange` event so the app pauses as soon as the user picks
a wallpaper, and doesn't overwrite it on Space switches. Then bring the docs in line.

- [X] T103 [P] Extend `tests/core/rotation/external-change.test.ts`:
  - `engine.externalChange()` while `running` sets `mode = 'pausedExternalChange'` and
    `nextChangeAt = null`, without calling `desktop.set`
  - while `paused` or `stopped`, it does nothing
  - after `resume()`, the next due `tick()` calls `set` (which, through the helper, clears its
    latch)
  - the existing pre-change `get` check tests still pass unchanged
- [X] T104 Add `externalChange()` to `src/core/rotation/engine.ts`. Makes T103 pass.
- [X] T105 Add the wallpaper-store watcher to `native/helper/main.swift`:
  - **Watching**: open
    `~/Library/Application Support/com.apple.wallpaper/Store/Index.plist` with `O_EVTONLY`, and
    watch it with `DispatchSource.makeFileSystemObjectSource(fileDescriptor:eventMask: [.write, .rename, .delete], queue: .main)`.
    After `.rename` or `.delete`, cancel the source, re-open the file once it reappears
    (checking every 0.5 s, at most 10 times), and watch again.
  - **Self-suppression**: ignore events within 3 s of `lastSelfSet`.
  - **Reporting**: otherwise, if `current != nil && !latched`, read `get` paths. If any path
    doesn't start with the resolved `--photos-dir` + `/`, set `latched = true` and emit
    `{"event":"externalChange","paths":[…]}`.
  - **Missing store**: if the store file doesn't exist at start-up, log one line to stderr and
    skip watching (the fallback).
  - **Don't parse it**: never read the plist's contents.

  Skip this task if spike T088 failed. Rebuild with `npm run build:native`.
- [X] T106 Wire the event in `src/main/main.ts`:
  `desktop.onExternalChange(() => void engine.externalChange())`. Then check that
  `tests/main/helper-desktop.test.ts` (the T092 events case) still passes. Skip this task if
  spike T088 failed.
- [X] T107 [P] Update `README.md`:
  - remove the Spaces item from "Known limitations"
  - change `npm run build:saver` to `npm run build:native` (which builds `pw-helper` and the
    screensaver)
  - in "Develop", note that `native/` holds the two Swift pieces
  - in "Package, sign and notarize", say that `DEVELOPER_ID` also signs `pw-helper`
  - remove the paragraph about `wallpaper`'s binary, if there is one
- [X] T108 [P] Update the "Implementation Notes" section of
  `specs/001-photos-wallpaper-rotation/tasks.md` with a short Amendment A entry: the package was
  removed, `pw-helper` was added, the Spaces gap is closed, and the T088 outcome.
- [ ] T109 Final checks:
  - `npm test`, `npm run typecheck`, `npm run build` and `npm run build:native` all pass
  - `grep -rl "from 'electron'" src/core` finds nothing
  - `npm ls wallpaper` reports it's not installed
  - (needs a person) quickstart scenario 14: change the wallpaper in System Settings, see the
    menu status change at once, switch Spaces and confirm the user's wallpaper stays, then
    Resume and see the next change show a Google photo

---

## Amendment Dependencies & Execution Order

- **Phase 7**: T085 → T086 → T087. T088, the spike, is done by a person and can happen at any
  time before T105.
- **Phase 8**: depends on Phase 7. T089 → T090. T091 is [P] with both.
- **Phase 9, US1**:
  - T092 needs T090 and T091.
  - T093 → T094.
  - T095 → T096 builds the Swift helper, independently of the TypeScript tasks.
  - T097 needs T092.
  - T098 needs T094, T096 and T097.
  - Then T099, then T100, the manual check.
- **Phase 10, US2**: needs T086 only, so it can run alongside Phase 9.
- **Phase 11**: T103 → T104. T105 needs T095 and the T088 result. T106 needs T097, T104 and T105.
  T107 and T108 are [P]. T109 is last.

### Parallel Opportunities

- T087 can run alongside T086, once T085 is done.
- T089 and T091.
- T092 and T093, which are in different files.
- The Swift track (T095 → T096) can run alongside the TypeScript track (T093 → T094 → T097).
- Phase 10 can run alongside Phase 9.
- T107 and T108.

### Parallel Example: Amendment US1

```bash
Task: "T092 helper-desktop tests in tests/main/helper-desktop.test.ts"
Task: "T093 engine stop/clear and set-failure tests in tests/core/rotation/engine.test.ts"
Task: "T095 pw-helper in native/helper/main.swift"
```

### Implementation Strategy

1. Phase 7 and Phase 8: the app still uses the old adapter, and everything stays green.
2. Phase 9: switch to `pw-helper` (T098), then remove the package (T099). This is the MVP of the
   amendment: same behavior, no package, and Spaces fixed.
3. Phase 10: confirm the screensaver after the move.
4. Phase 11: instant manual-change detection, if spike T088 passes, then the docs.
