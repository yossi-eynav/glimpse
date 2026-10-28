# Contract: App ↔ `pw-helper` (wallpaper helper process)

Source: [research.md R5](../research.md). `pw-helper` is our own Swift program, started by the
Electron main process as a child process. It is the only code that touches the macOS wallpaper.

- **Encoding**: `src/core/wallpaper/helper-protocol.ts` (pure, unit-tested).
- **Process client**: `src/main/platform/helper-desktop.ts`, which implements the core `Desktop`
  interface.
- **Helper**: `native/helper/main.swift`.

## Transport

- **Launch**: `spawn(helperPath, ['--photos-dir', <userData>/Photos], {stdio: ['pipe', 'pipe', 'pipe']})`.
  - **Packaged app**: `helperPath` is `<Resources>/pw-helper`.
  - **Development**: `build/pw-helper`.
- **Framing**: UTF-8 JSON, **one object per line** (`\n`-terminated), in both directions. Lines
  longer than 64 KiB are a protocol error.
- **stderr**: free-form diagnostics only. The app logs it at `warn` and never parses it.
- **Version**: the helper's first stdout line is the `ready` event. If its `version` isn't
  supported, the client kills the helper and reports `HelperIncompatible`.

## Requests (app → helper)

Every request has an integer `id`, unique per helper process. The helper answers each request
with exactly one response carrying the same `id`, in any order.

| `cmd` | Fields | Effect | Response |
|-------|--------|--------|----------|
| `show` | `path`: absolute path of a JPEG inside `--photos-dir` | Sets `path` on every screen of the active Space, with `imageScaling = .scaleProportionallyUpOrDown` and `allowClipping = true`. Makes it the *current* photo, re-applied on later Space and screen changes. Clears the `externalChange` latch | `{"id", "ok": true}`, or `{"id", "ok": false, "error": "<message>"}` (for example, missing file, path outside `--photos-dir`, or AppKit error) |
| `get` | — | Reads `desktopImageURL(for:)` for each screen | `{"id", "ok": true, "paths": ["<screen 0>", …]}` |
| `clear` | — | Forgets the current photo, so nothing is re-applied on Space changes. The wallpaper itself isn't changed | `{"id", "ok": true}` |

Examples:

```json
{"id":1,"cmd":"show","path":"/Users/me/Library/Application Support/Google Photos Wallpaper/Photos/item-1.jpg"}
{"id":1,"ok":true}
{"id":2,"cmd":"get"}
{"id":2,"ok":true,"paths":["/Users/me/Library/Application Support/Google Photos Wallpaper/Photos/item-1.jpg"]}
```

## Events (helper → app)

Events have an `event` field and no `id`.

| `event` | Fields | When |
|---------|--------|------|
| `ready` | `version`: `1` | Once, at start-up, before any response |
| `applied` | `reason`: `"space"` \| `"screens"`, `path` | The helper re-applied the current photo after a Space switch or a display change. Informational only; the app logs it at `info` |
| `externalChange` | `paths`: current path per screen | The wallpaper store changed, and the change is not explained by the helper's own `show` within the last 3 s. At least one screen now shows a path outside `--photos-dir`. After sending this, the helper **stops re-applying on Space changes until the next `show`** (the latch) |

## Rules

1. **Path check**: `show` is refused for any path that isn't a regular file inside
   `--photos-dir`. That way the helper can never be asked to display an arbitrary file.
2. **Space re-apply**: on `NSWorkspace.activeSpaceDidChangeNotification` and on
   `NSApplication.didChangeScreenParametersNotification`, if there is a current photo and no
   latch, any screen whose `desktopImageURL` isn't the current photo is set to it, and an
   `applied` event is sent.
3. **External-change detection**: a `DispatchSource` file-system watcher on
   `~/Library/Application Support/com.apple.wallpaper/Store/Index.plist` (rewrite, rename or
   delete). The helper re-opens the file after an atomic replace. The file's contents are never
   parsed (research R5).
4. **Self-suppression**: store changes within 3 s of the helper's own `setDesktopImageURL` call
   are ignored.
5. **Engine reaction** (`src/main/main.ts`): on `externalChange`, the app calls
   `engine.externalChange()`, which sets `mode = 'pausedExternalChange'` and
   `nextChangeAt = null`. **Resume** makes the next change call `show`, which clears the latch.
6. **Fallback**: the engine's check before each scheduled change (`get`, then the path test)
   stays. FR-018 therefore still holds if the store watcher misses an event.

## Lifecycle and supervision (`helper-desktop.ts`)

| Situation | Behavior |
|-----------|----------|
| App start | Spawn, wait for `ready` (up to 5 s), then `show <current>` if `rotation.currentPhotoId` is set and the mode is `running` or `paused` |
| Request while the helper is down or still starting | Queued until `ready`. If it isn't ready within 5 s, the request rejects with `HelperUnavailable`. The engine treats a failed `show` like a failed change: the state is unchanged and the next tick retries |
| No response within 5 s | The request rejects with `HelperTimeout`, and the helper is killed and restarted |
| Unexpected exit | Restart after 1 s, 2 s, 4 s, …, at most 5 restarts in 10 minutes, then give up and log at `error`. Every pending request rejects with `HelperUnavailable`. After each restart, the client sends `show <current>` again |
| App quit (`before-quit`) | Close stdin, which makes the helper exit cleanly, then `SIGTERM` after 1 s |
