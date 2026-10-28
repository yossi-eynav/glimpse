# Research: Apply New Photos on Done, and Turn Off

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-28

## R1. Showing a new photo on Done (FR-001 to FR-005)

- **Decision**:
  - **Finding the new photos**: `SelectionDraft.commit()` also returns `addedIds`: the photos
    added in this draft and still in the selection. The session passes them on as
    `onSelectionCommitted({addedIds})` → `engine.selectionChanged({addedIds})`.
  - **Engine**: if the app is on and `addedIds` isn't empty, it sets `mode = 'running'` and then:
    - **If some added photos are already saved** and their file is a valid JPEG: show one picked
      with `pickRandom` over just those photos, then `schedule()` the next change.
    - **Otherwise**: remember `pendingShow = new Set(addedIds)`. This is held in memory only,
      not in `state.json`.
  - **Download finished**: the session already pushes download updates into the engine through
    `engine.update`. It now calls `engine.photoStatusChanged(id, status)` instead.
    - When a `pendingShow` photo becomes `saved`, the engine shows it at once and clears
      `pendingShow`.
    - When none of `pendingShow` is still `pending`, the engine clears it. If nothing is on
      screen and some other photo is saved, it makes a normal change.
  - **Picking**: feature 002's `pickRandom(currentId, selection, random)` is reused, with a
    selection filtered to the added IDs.
- **Rationale**:
  - The engine is already the single owner of "what's on screen", and it already serializes
    every change.
  - Tracking `pendingShow` covers picks whose downloads are still running at Done, without
    polling.
- **Alternatives considered**:
  - **Showing any random photo on Done**: the user explicitly wants a new photo.
  - **Waiting in the session for downloads before committing**: it would block Done, and the
    session isn't where display state lives.
  - **Persisting `pendingShow`**: after a restart the downloads are gone anyway (feature 001
    R1), so persisting it buys nothing.

## R2. Recording and restoring the original wallpaper (FR-006 and FR-008)

- **Decision**:
  - **Recording**: just before the engine's first-ever `desktop.set` (`state.original === null`),
    and on every Turn on, the engine calls `desktop.get()` and stores
    `original = {wallpapers: string[], recordedAt}` in `state.json`, with one path per display.
    A path inside the app's `Photos/` folder isn't a real original, because the app set it, so
    it's stored as `null`.
  - **Restoring** uses a new helper command, `restore` (see
    [contracts/wallpaper-helper-restore.md](./contracts/wallpaper-helper-restore.md)). It takes
    the original path for each display index.
    1. For each display currently showing a file inside `--photos-dir`, it sets the original path
       if that file exists, or else `/System/Library/CoreServices/DefaultDesktop.heic`.
    2. Displays showing anything else (a choice the user made) are left alone (spec US2
       scenario 2).
    3. It clears the current photo and keeps a **restore target**, so that later Space and
       display changes also put the original back on Spaces still showing an app photo. That
       way the restore reaches other Spaces as the user visits them (spec edge case).
- **Rationale**:
  - The helper is the only process that touches the wallpaper (feature 001 R5).
  - Restoring only the app's own photos never overwrites a later choice by the user.
- **Open item (spike S1)**: on macOS 14 and later, check that `desktopImageURL(for:)` returns
  something re-settable for dynamic `.heic` and Aerial wallpapers. If an Aerial reads back as a
  placeholder image, restoring it gives a still frame. In that case the Turn off message also
  says "If your wallpaper was a moving one, re-select it in System Settings → Wallpaper".
- **Alternatives considered**:
  - **Copying the original image file**: system wallpapers are read-only and can change across
    OS updates, so the path is enough.
  - **Writing `com.apple.wallpaper` preferences**: an undocumented format (feature 001 R5).

## R3. Turning the screensaver off (FR-009 and FR-014)

- **Decision**: when `useForScreensaver` is on, Turn off does three things:
  1. `handoff.disable()`: the saver immediately shows its "turned off" state (feature 001
     contract).
  2. `uninstallSaver()`: deletes `~/Library/Screen Savers/PhotoWallpaperSaver.saver`.
  3. A non-blocking message: "Your screensaver has been turned off. Choose a screensaver in
     System Settings → Screen Saver.", with an **Open Screen Saver Settings** button, which opens
     `x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension`.

  Turn on calls the existing `installSaver` and shows the existing "select it" message
  (feature 001 FR-021). `useForScreensaver` itself is kept (FR-010).
- **Rationale**: macOS 14 and later give apps no supported way to *select* a screensaver, so the
  best an app can do is remove its own and send the user to the right pane.
- **Open item (spike S2)**: after the selected `.saver` is deleted, check what macOS shows when
  the screensaver starts: its default screensaver, or a blank or broken one.
  - **If the default**: the message is enough.
  - **If broken**: keep the bundle installed, but leave the handoff disabled (black screen with
    the "turned off" text), and change the message to "Choose another screensaver in System
    Settings". Record the result here.
- **Alternatives considered**:
  - **`defaults -currentHost write com.apple.screensaver moduleDict`**: ignored since macOS 14.
  - **Automating System Settings with AppleScript UI scripting**: needs the Accessibility
    permission and is fragile.

## R4. The power state and "off" behavior (FR-010 to FR-013)

- **Decision**:
  - **State**: `AppState.power: 'on' | 'off'`, default `'on'`, kept in `state.json`. Older state
    files without the field load as `'on'`.
  - **`engine.turnOff()`**, run one at a time in the engine's queue:
    1. cancel `pendingShow`
    2. set `rotation` to stopped
    3. `desktop.restore(original)`
    4. `handoff.disable()` when relevant
    5. set `power = 'off'`
  - **`engine.turnOn()`**:
    1. set `power = 'on'`
    2. record the originals (R2)
    3. `start()`
  - **Guards**: every entry point that can change the wallpaper (`start`, `tick`, `next`,
    `resume`, `restore` on launch, `displaysChanged`, `photoStatusChanged`, `selectionChanged`)
    returns early when `power === 'off'`.
  - **Helper while off**: it has no current photo (`restore` clears it), so it stops re-applying
    on Space changes too.
- **Main process**:
  - the `turnOff` handler closes the selection window (discarding any pick), then calls
    `engine.turnOff()`, then shows the screensaver message when relevant
  - the `turnOn` handler calls `engine.turnOn()`, then runs the existing screensaver install
    flow when `useForScreensaver` is on
- **Rationale**: one flag checked at the engine's entry points enforces FR-011 in one place, and
  it can be unit-tested with the fake desktop.
- **Alternatives considered**:
  - **Quitting the app on Turn off**: the owner chose to keep the app in the menu bar.
  - **Reusing `mode = 'stopped'` as "off"**: Start, Done and wake can all change `stopped`,
    while "off" must stay put until Turn on.

## R5. Testing (Principle I)

- **Decision**: all the new behavior is in `src/core` and is unit-tested with the existing fakes:
  - `FakeDesktop` gets `restore()`, which records the originals it receives and applies the
    "only our photos" rule.
  - `ManualClock`, `MemoryFileSystem` and a seeded `random`.
  - The helper's `restore` request encoding goes in `helper-protocol.test.ts`. The client goes in
    `helper-desktop.test.ts`, using the fake helper extended with `restore`.
  - The Swift side is covered by manual checks and the spikes, as before.
