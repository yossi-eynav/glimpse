# Contract Delta: `pw-helper` `restore` command

This extends [feature 001's wallpaper-helper contract](../../001-photos-wallpaper-rotation/contracts/wallpaper-helper.md).
The protocol version stays **1**: `restore` is a new request, and older requests behave as
before. A client that sends `restore` to an older helper gets back
`{ok: false, error: "unknown command"}`, and treats that as a failed Turn off, which it retries
after the helper restarts.

## Request

| `cmd` | Fields | Effect | Response |
|-------|--------|--------|----------|
| `restore` | `paths`: `(string \| null)[]`, the original wallpaper for display index *i* | See below | `{"id", "ok": true, "restored": <count of displays changed>}`, or `{"id", "ok": false, "error"}` |

**Effect, applied to each `NSScreen.screens[i]`:**

1. If the display's current `desktopImageURL` is **not** inside `--photos-dir`, leave it
   unchanged, because the user chose it.
2. Otherwise, set `target = paths[i]` when that is a non-null, existing regular file, or else
   `/System/Library/CoreServices/DefaultDesktop.heic`. Call
   `setDesktopImageURL(target, options: [:])`, which uses the system default scaling.

**After the request:**

- `current = nil`, so photos are no longer re-applied.
- `latched = false`.
- `restoreTargets = paths`. From now on, on a Space change or a display change, any display
  still showing a file inside `--photos-dir` is restored the same way. That way the restore
  reaches Spaces as the user visits them.
- `restoreTargets` is cleared by the next `show`, which happens on Turn on.

**Example:**

```json
{"id":7,"cmd":"restore","paths":["/System/Library/Desktop Pictures/Sonoma.heic",null]}
{"id":7,"ok":true,"restored":2}
```

**Path rules**: `restore` may set paths **outside** `--photos-dir`, which `show` refuses. Each
path must be an existing regular file; anything else falls back to the macOS default. The
helper never deletes or writes files.
