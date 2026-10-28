# Contract: Menu Bar UI

`menuModel(state, notice, now, locale)` in `src/core/menu/menu-model.ts` is a pure function. It
returns `MenuItem[]`, a union of `action`, `toggle`, `submenu`, `separator` and `label`. Each
item carries an `id` that the main process maps to a handler.

`toElectronMenu()` in `src/main/tray.ts` maps those items one to one onto Electron
`MenuItemConstructorOptions`. Both functions are unit-tested against this contract.

## Signed out (FR-002)

```text
[tray icon]
├── Sign in with Google        id: signIn
└── Quit                       id: quit
```

## Signed in (FR-003)

Items appear in exactly this order:

```text
[tray icon]
├── ⚠ <notice>                          label; clickable if the notice has an action (FR-004)
├── <status line>                       label (disabled)
├── <N> photos selected                 label (disabled), N = availableCount
├── ─────────
├── Choose Google Photos images…        id: chooseImages
├── Change every ▸                      submenu, radio items:
│     5 min | 15 min | 30 min | 1 hour | 6 hours | 1 day     id: interval:<minutes>
│     ─────────
│     Custom…                           id: customInterval
├── Start rotation | Pause | Resume     id: start | pause | resume; disabled when N == 0
├── Next photo                          id: next; disabled when N == 0
├── ─────────
├── Use for screensaver                 checkbox, id: toggleScreensaver
├── Start at login                      checkbox, id: toggleLogin
├── ─────────
├── <email>                             label (disabled)
├── Sign out                            id: signOut
└── Quit                                id: quit
```

If the current interval isn't a preset, a checked radio item `Custom (<n> min)` appears above
`Custom…`.

**Start, Pause and Resume item**

| Mode | Item |
|------|------|
| stopped, blockedNoPhotos | `Start rotation` |
| running | `Pause` |
| paused, pausedExternalChange | `Resume` |

**Status line**

| Mode | Text |
|------|------|
| stopped | `Rotation stopped` |
| running | `Next change at HH:mm`, or `Next change <Ddd> HH:mm` when it isn't today (24-hour format, local time) |
| paused | `Paused` |
| pausedExternalChange | `Paused — wallpaper changed in System Settings` |
| blockedNoPhotos | `Stopped — no photos available` |

**Notices**: only the highest-priority notice is shown.

| Priority | Condition | Text | Click |
|----------|-----------|------|-------|
| 1 | `account.status === 'needsReauth'` | `Sign in again to change your photos` | `signIn` |
| 2 | Low disk space (R9) | `Low disk space — new photos aren't being saved` | — |
| 3 | `!isOnline()` and some photo is `pending` | `Offline — <k> photos waiting to download` | — |
| 4 | Some photo is `unavailable` | `<k> photos unavailable` | `chooseImages` |

When `needsReauth` is set, `chooseImages` runs sign-in before opening the dialog.

## Selection dialog (FR-006 to FR-009, R3)

**Superseded by feature 003**: see
[`specs/003-selection-dialog-redesign/contracts/selection-dialog-ui.md`](../../003-selection-dialog-redesign/contracts/selection-dialog-ui.md).
The window was rebuilt with Material UI. The permanent "videos skipped" note was replaced by a
one-time message, and "Clear all" now confirms in an in-window dialog.

## Custom interval prompt (FR-012)

A small `BrowserWindow` with a whole-number field and a unit `<select>` (minutes, hours, days).
OK is enabled only when 1 ≤ total minutes ≤ 10080. Otherwise it shows the hint
`Between 1 minute and 7 days`. The same check runs again in the main process.
