# Data Model: Sleek Selection Dialog (Material UI) and Video Handling

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

There are no changes to stored data or to IPC types. `DraftView` and `PickResult` stay exactly as
in [feature 001's IPC contract](../001-photos-wallpaper-rotation/contracts/ipc.md). This feature
adds **renderer view models**: pure functions in `src/renderer/selection/view-model.ts`.

## headerTitle(view: DraftView) → string

| `view.photos.length` | Result |
|----------------------|--------|
| 0 | `No photos yet` |
| 1 | `1 photo` |
| n > 1 | `n photos` |

`skippedNonPhotoCount` is **not** shown here (spec FR-010).

## TileModel

`tileModel(photo: DraftPhotoView) → TileModel`

| Field | Type | Rule |
|-------|------|------|
| id | string | `photo.id` |
| state | `'ready' \| 'loading' \| 'unavailable'` | `saved` → `ready`, `pending` → `loading`, `unavailable` → `unavailable` |
| thumbUrl | string \| null | `photo://thumb/<encodeURIComponent(id)>` for `ready` and `unavailable`; `null` for `loading` |
| label | string | `Photo` for ready; `Downloading…` for loading; `This photo is unavailable. Remove it, or pick it again.` for unavailable (the tooltip and `aria-label`) |

## PickMessage

`pickMessage(result: PickResult) → { severity: 'success' | 'info' | 'warning' | 'error'; text: string } | null`

| `result` | Severity | Text |
|----------|----------|------|
| `added`, `added > 0`, `skipped = 0` | success | `Added {added} {photo/photos}` |
| `added`, `added > 0`, `skipped > 0` | success | `Added {added} {photo/photos} · {skipped} {video/videos} ignored (only photos can be wallpapers)` |
| `added`, `added = 0`, `skipped > 0` | info | `Only photos can be wallpapers. {skipped} {video was/videos were} ignored.` |
| `added`, `added = 0`, `skipped = 0` | — | `null` (nothing picked) |
| `cancelled` | — | `null` |
| `timedOut` | warning | `The Google Photos picker timed out. Try again.` |
| `needsSignIn` | warning | `Your Google sign-in expired. Choose "Sign in again" in the menu bar, then try again.` |
| `error` | error | `result.message`, unchanged (keeps the specific wording from `describePickerError`) |

Every count uses `plural(n, singular, pluralForm)`. "1 video", "2 videos", "1 photo" and
"3 photos" are all covered by tests.

## Dialog UI state (React, in `SelectionApp`)

| State | Type | Transitions |
|-------|------|-------------|
| draft | `DraftView` | set from `getDraft()`, `remove()`, `clearDraft()` and `onDraftChanged` |
| picking | boolean | true while `pick()` is pending; Cancel calls `cancelPick()` |
| confirmClear | boolean | opened by "Clear all"; Confirm calls `clearDraft()`; Cancel closes it |
| message | `PickMessage \| null` | set from `pickMessage(result)` after each pick; auto-hides after 6 s; a newer message replaces it |
