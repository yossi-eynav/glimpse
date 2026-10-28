# Quickstart & Validation: Sleek Selection Dialog (Material UI) and Video Handling

## Prerequisites

The same as feature 001 ([quickstart](../001-photos-wallpaper-rotation/quickstart.md)). Then run
`npm install`, which now also installs React, MUI, Emotion and esbuild.

## Automated checks

```sh
npm test            # includes tests/renderer/selection-view-model.test.ts and selection-render.test.ts
npm run typecheck   # includes the .tsx renderer
npm run build       # tsc (main) + esbuild (renderer) + copy-static
ls -lh dist/renderer/selection/selection.js   # one bundle; expect roughly 300–500 KB minified
```

## Manual validation scenarios

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| 1 | US1 | `npm start`, sign in, then choose "Choose Google Photos images…" with no photos selected | An empty state with an icon, text and an "Add from Google Photos" button. The window appears styled at once, with no white flash |
| 2 | US1 | Add about 20 photos | An even grid of rounded thumbnails, and the header reads "20 photos". Tiles show animated placeholders until their thumbnails arrive |
| 3 | US1 | Hover over a tile and click × | The tile disappears, and the count updates |
| 4 | US1 | ⋯ → Clear all → Cancel, then ⋯ → Clear all → Remove all | Cancel changes nothing; Remove all empties the grid. Both happen in an in-window dialog |
| 5 | US1 | Switch macOS between Light and Dark appearance while the window is open | The window follows immediately |
| 6 | US1 | Select about 1,000 photos and scroll quickly | Smooth scrolling (SC-002). If not, note it for research R5 (virtualization) |
| 7 | US1 | Resize to the minimum size | The grid shows fewer columns, and the header buttons stay visible |
| 8 | US1 | Press Esc; reopen; press ⌘↩ | Esc cancels and closes; ⌘↩ saves and closes |
| 9 | US2 | Add from Google Photos: pick 2 photos and 1 video | 2 tiles, and the message "Added 2 photos · 1 video ignored (only photos can be wallpapers)" |
| 10 | US2 | Add from Google Photos: pick only 2 videos | No tiles added, and the message "Only photos can be wallpapers. 2 videos were ignored." |
| 11 | US2 | Close and reopen the window | No note about videos anywhere |
| 12 | Edge | Turn Wi-Fi off, then open the window | It renders fully, with fonts and icons (FR-012) |
| 13 | Edge | Pick, then close the window while the browser picker is still open | The pick is cancelled, as in feature 001 |

## Recorded results

- **2026-10-28, T015**: `NODE_ENV=production npm run build` produces
  `dist/renderer/selection/selection.js` at **472 KB** minified (within the 300–500 KB estimate).
  `index.html` contains no remote URLs, and `npm test` passes 192 of 192.
