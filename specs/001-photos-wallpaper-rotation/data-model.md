# Data Model: Google Photos Wallpaper & Screensaver Rotation

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

All types are TypeScript, defined in `src/core/persistence/app-state.ts`. Enums are written as
string-literal unions, because erasable syntax is required (R10).

Everything below is saved as one `AppState` in `userData/state.json` (R9). OAuth tokens are
**not** part of it: they live only in `userData/tokens.bin`, encrypted with `safeStorage` (R4).

```text
AppState
├── account:   AccountConnection
├── selection: Selection ── photos: SelectedPhoto[]
├── settings:  RotationSettings
└── rotation:  RotationState ── currentPhotoId → SelectedPhoto.id
```

Dates are stored as epoch milliseconds (`number`).

## AccountConnection

| Field | Type | Rules |
|-------|------|-------|
| status | `'signedOut' \| 'signedIn' \| 'needsReauth'` | Default `'signedOut'`. Decides which menu is shown (FR-002, FR-003) |
| email | `string \| null` | Set on sign-in from the `id_token` claims, and cleared on sign-out |

`OAuthTokens` is `{accessToken, refreshToken, expiresAt}`. It is stored only encrypted, and is
never logged or sent to the renderer.

**Transitions**

```text
signedOut   --sign-in succeeds-->                             signedIn
signedIn    --refresh returns invalid_grant, or 401 after refresh--> needsReauth
needsReauth --sign-in succeeds-->                             signedIn
signedIn | needsReauth --Sign out-->                          signedOut
    side effects: rotation.mode = 'stopped'; selection emptied; every Photos/* and Thumbs/*
    file deleted; tokens.bin deleted; token revoked (best effort)
```

## SelectedPhoto

| Field | Type | Rules |
|-------|------|-------|
| id | `string` | The Picker media item ID. Unique within `selection.photos` |
| createdAt | `number \| null` | From the Picker's `createTime` |
| width, height | `number` | Original pixel size. Each is an integer > 0 |
| status | `'pending' \| 'saved' \| 'unavailable'` | Default `'pending'` |
| addedAt | `number` | When the photo first entered the selection |

**Derived paths** (not stored): `Photos/{id}.jpg` and `Thumbs/{id}.jpg` under `userData`.

**Validation**

- Only Picker items with `type === 'PHOTO'` and a `mediaFile.mimeType` starting with `image/`
  are accepted. All others are counted into `selection.skippedNonPhotoCount` (FR-009).
- An `id` that is already present is ignored, never duplicated.

**Transitions**

```text
pending --both downloads ok-->                            saved
pending --download fails after retries, or baseUrl expired--> unavailable
saved   --file missing or not a JPEG when about to be shown--> unavailable
unavailable --picked again in a new session-->            pending
any     --removed from selection | sign-out-->            deleted (both files removed, FR-011)
```

## Selection

| Field | Type | Rules |
|-------|------|-------|
| photos | `SelectedPhoto[]` | Kept in insertion order |
| skippedNonPhotoCount | `number` | From the most recent picker session. Integer ≥ 0 |

**Derived**: `availableCount` is the number of photos with `status === 'saved'`. It is shown in
the menu as `<N> photos selected`.

**Draft editing (FR-008)**: `SelectionDraft` (in `src/core/library/selection-draft.ts`) is a
copy of the selection plus `addedIds` and `removedIds`.
- `commit()` returns `{selection, removedIds}`, and the caller deletes the removed files.
- `discard()` leaves the saved selection unchanged.

## RotationSettings

| Field | Type | Rules |
|-------|------|-------|
| intervalMinutes | `number` | Integer, 1 ≤ value ≤ 10080 (7 days). Default 30. Presets: 5, 15, 30, 60, 360, 1440 (FR-012) |
| useForScreensaver | `boolean` | Default `false` (FR-021) |
| startAtLogin | `boolean` | Default `false`. Updated from `app.getLoginItemSettings().openAtLogin` on launch (FR-023) |

## RotationState

| Field | Type | Rules |
|-------|------|-------|
| mode | `'stopped' \| 'running' \| 'paused' \| 'pausedExternalChange' \| 'blockedNoPhotos'` | Default `'stopped'` |
| currentPhotoId | `string \| null` | The photo currently set as the wallpaper |
| ~~shownThisRound~~ | ~~`string[]`~~ | **Superseded by feature 002 (fully random picks):** removed, and dropped when an old `state.json` loads |
| nextChangeAt | `number \| null` | Not null only when `mode === 'running'` |

**Mode transitions**

```text
stopped              --Start (availableCount > 0)-->                running
running              --Pause-->                                     paused
paused               --Resume-->                                    running
running              --pw-helper `externalChange` event, or the
                       pre-change `get` finds a path outside Photos/ (R5)--> pausedExternalChange
pausedExternalChange --Resume-->                                    running
running              --no saved photo left-->                       blockedNoPhotos
blockedNoPhotos      --a photo becomes saved-->                     running
any                  --Sign out-->                                  stopped
```

**Wallpaper helper (contracts/wallpaper-helper.md)**: the helper holds no persistent state. It
mirrors `currentPhotoId`:
- **`show`**: sent on every change, and again after a helper restart.
- **`clear`**: sent on `stop` and on sign-out.

It does not pause or resume itself. Its `externalChange` latch is cleared by the next `show`.

**Choosing the next photo (FR-014, SC-006)**: **Superseded by feature 002 (fully random picks):** see
[`specs/002-random-photo-picks/data-model.md`](../002-random-photo-picks/data-model.md). The
round-based steps below are kept for history only.

1. Candidates are the `saved` photos that are not in `shownThisRound`. When more than one photo
   is saved, `currentPhotoId` is also left out.
2. If there are no candidates, empty `shownThisRound` (a new round) and repeat step 1.
3. Pick one candidate with the injected `random()`, set `currentPhotoId`, and add it to
   `shownThisRound`.
4. When the selection is edited, remove IDs no longer in it from `shownThisRound`. Shown IDs
   that are still selected keep their place (US3 scenario 4).

**Timing (FR-016, FR-017; R8)**

- Every change, whether from `start`, `resume`, `next`, a tick, or a new interval, sets
  `nextChangeAt = now + intervalMinutes × 60000`.
- `tick()` changes the photo only when `mode === 'running'` and `now >= nextChangeAt`. Launch
  and wake each call `tick()` once.
