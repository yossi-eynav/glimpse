# Contract: Selection Dialog UI (Material UI)

This replaces the "Selection dialog" table in
[feature 001's menu-ui contract](../../001-photos-wallpaper-rotation/contracts/menu-ui.md). The IPC
(`window.selection`, see feature 001's `contracts/ipc.md`) is unchanged. The texts come from
[data-model.md](../data-model.md).

## Window

| Property | Value |
|----------|-------|
| Size | 720×560 by default, 560×420 minimum (unchanged) |
| Title bar | `titleBarStyle: 'hiddenInset'`. The traffic lights sit over the header, and the header is the drag region |
| Background | `nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f5f5f7'`, so there's no white flash |
| CSP | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' photo:; font-src 'self'; connect-src 'none'` (research R3) |
| Theme | One MUI theme with light and dark color schemes, following `prefers-color-scheme` live. System font, primary `#0A84FF`, radius 10, no uppercase buttons |

## Layout (top to bottom)

```text
┌──────────────────────────────────────────────────────────────┐
│ ●●●   Choose photos                  [⊕ Add from Google Photos] [⋯] │  header (drag region; 52 px)
│       12 photos                                                   │
├──────────────────────────────────────────────────────────────┤
│  ▢ ▢ ▢ ▢ ▢ ▢                                                      │  ImageList (4/5/6 cols, gap 6)
│  ▢ ▢ ▣ ▢ ░ ▢        ▣ = unavailable (dimmed + ⚠)  ░ = loading      │  scrolls
├──────────────────────────────────────────────────────────────┤
│                                          [Cancel]  [Done]         │  footer
└──────────────────────────────────────────────────────────────┘
```

| Element | MUI components | Behavior |
|---------|----------------|----------|
| Title | `Typography variant="h6"` with the text "Choose photos" | Static |
| Count | `Typography variant="body2" color="text.secondary"` | `headerTitle(draft)` |
| Add | `Button variant="contained" startIcon={<AddPhotoAlternateOutlined/>}` | Calls `pick()`. Disabled while picking |
| More (⋯) | `IconButton` + `Menu` containing the item "Clear all" (disabled when the draft is empty) | Opens the clear-all confirmation |
| Grid | `ImageList` / `ImageListItem` | One tile per draft photo, in draft order |
| Tile, ready | `<img loading="lazy" decoding="async">`, radius 8 | On hover, shows a remove `IconButton` (`CloseRounded`, `aria-label="Remove photo"`) at the top-right |
| Tile, loading | `Skeleton variant="rounded" animation="wave"` | `aria-busy="true"`, `aria-label="Downloading…"`. Still removable |
| Tile, unavailable | Dimmed `img` (opacity 0.35) + `WarningAmberRounded`, with a `Tooltip` showing the tile label | `aria-label` is the tile label. Removable |
| Empty state | A centered `PhotoLibraryOutlined` icon (64 px), the text "No photos yet", the secondary text "Pick photos in Google Photos to use them as your wallpaper.", and an `Add from Google Photos` button | Shown when the draft is empty |
| Picking overlay | `Backdrop open` + `CircularProgress` + "Finish choosing in your browser…" + `Button` labelled "Cancel" | Shown while `pick()` is pending. Cancel calls `cancelPick()` |
| Clear-all confirmation | `Dialog` with the title "Remove all photos?", the body "This only changes this list. Your Google Photos library isn't touched.", and the actions `Cancel` / `Remove all` (color error) | Confirming calls `clearDraft()` |
| Message | `Snackbar anchorOrigin bottom-center autoHideDuration 6000` + `Alert variant="filled" severity=…` | Text from `pickMessage(result)`. The newest message replaces the previous one |
| Footer | `Button variant="text"` labelled `Cancel`, and `Button variant="contained"` labelled `Done` | Cancel calls `discard()`, and Done calls `commit()` (the main process closes the window) |
| Keys | — | `Esc` = Cancel (unless a dialog or menu is open, in which case it closes that first). `⌘↩` = Done |

## Not shown any more

- The permanent "· N videos skipped" header suffix (spec FR-010).
- The system `confirm()` alert for "Clear all" (spec FR-005).
