# Implementation Plan: Sleek Selection Dialog (Material UI) and Video Handling

**Branch**: `003-selection-dialog-redesign` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-selection-dialog-redesign/spec.md`, written
during this planning run from the owner's request.

## Summary

The selection window ("Choose Google Photos images…") is rebuilt with **MUI (Material UI) on
React 19**, bundled for the sandboxed renderer by **esbuild**:
- an inset title bar with a header that doubles as the drag region
- a light/dark theme that follows the system live, with the system font
- a thumbnail grid with loading skeletons and unavailable badges
- an empty state, a picking overlay, an in-window "Clear all" confirmation, transient messages,
  and the keyboard shortcuts Esc and ⌘↩

Video handling stays as it is, because videos are already excluded (feature 001, FR-009). What
changes is how it's explained: one correctly pluralized message per pick replaces the permanent
"videos skipped" note, and a pick of only videos says so plainly.

Behavior and text live in a pure, tested view model. The React components are checked by a
render smoke test. The IPC, the main-process logic, and everything in `src/core` stay unchanged.

## Technical Context

**Language/Version**: TypeScript 7. The renderer is now **TSX**, with `"jsx": "react-jsx"`. The
main process and `src/core` are unchanged.

**Primary Dependencies**:
- **New runtime dependencies, bundled into the renderer**: `react` and `react-dom` 19.3.1,
  `@mui/material` and `@mui/icons-material` 9.5.0, and `@emotion/react` 11.14 and
  `@emotion/styled` 11.14.
- **New dev dependencies**: `esbuild` 0.28.2, `@types/react` and `@types/react-dom` 19.3.
- Existing dependencies are unchanged.

**Storage**: N/A, with no changes.

**Testing**:
- `node:test` for the view model.
- A render smoke test: esbuild bundles an entry, and `react-dom/server` `renderToString`
  renders it with no jsdom (research R7).
- Manual scenarios in [quickstart.md](./quickstart.md).

**Target Platform**: macOS 14 or later, in the Electron 45 renderer (Chromium). Unchanged.

**Project Type**: desktop-app. This changes the existing app's renderer.

**Performance Goals**:
- First styled paint within 1 s (SC-001).
- Smooth scrolling with 1,000 tiles (SC-002), using lazy-loading thumbnails.
- A bundle of about 300–500 KB minified, loaded from the local disk.

**Constraints**:
- **No network**: enforced by `connect-src 'none'` and local system fonts (FR-012).
- **Security**: the renderer stays sandboxed and isolated with `contextIsolation`. Scripts remain
  `'self'`-only. Only styles get `'unsafe-inline'`, for Emotion (research R3).

**Scale/Scope**:
- 1 window redesigned.
- About 6 new renderer files and 2 build scripts.
- 2 test files.
- 1 window option change in `windows.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.0) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change | ✅ The view-model tests (headings, tiles, every pick message and plural) and the render smoke test are written first. Components are thin and presentational (R7) |
| II. Simplicity | Each dependency is justified; deviations are logged | ⚠️→✅ There are six new runtime packages and one bundler. They're justified because the owner required MUI by name, and React and Emotion are MUI's required peers. They're kept to the minimum: no router, no state library, no virtualization, no test DOM. Logged in Complexity Tracking |
| Desktop: responsive UI | No UI-thread blocking | ✅ Rendering only; images lazy-load and decode asynchronously |
| Desktop: credentials | OS secure store | ✅ Not affected. The renderer still never sees tokens |
| Desktop: lifecycle | Launch, background, offline, quit or restart | ✅ Works offline (FR-012). Closing the window during a pick cancels it, as before |
| Desktop: stack recorded | Stack and packaging stated | ✅ This adds React, MUI and esbuild to the renderer's stack, recorded here |

**Pre-design gate**: PASS, with the dependency deviation justified.

**Post-design re-check**: PASS. The design keeps every new dependency inside the renderer
bundle. `src/core`, the IPC, and the main-process behavior are untouched.

## Project Structure

### Documentation (this feature)

```text
specs/003-selection-dialog-redesign/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/selection-dialog-ui.md
├── checklists/requirements.md
└── tasks.md             # from /speckit-tasks
```

### Source Code (repository root)

```text
package.json                  # + react, react-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled
                              # + dev: esbuild, @types/react, @types/react-dom
                              # build: tsc && node scripts/build-renderer.js && node scripts/copy-static.js
tsconfig.json                 # emit config: + "jsx": "react-jsx"; exclude src/renderer/selection/**
tsconfig.test.json            # typecheck: includes .tsx
scripts/
└── build-renderer.js         # NEW: esbuild bundles src/renderer/selection/main.tsx → dist/renderer/selection/selection.js

src/renderer/selection/
├── index.html                # EDIT: new CSP; <div id="root">; loads selection.js (module)
├── main.tsx                  # NEW: createRoot + ThemeProvider + CssBaseline + <SelectionApp api={window.selection}/>
├── theme.ts                  # NEW: createTheme (colorSchemes light/dark, system font, #0A84FF, radius 10)
├── SelectionApp.tsx          # NEW: state (draft, picking, confirmClear, message), keyboard shortcuts, layout
├── PhotoTile.tsx             # NEW: ready / loading / unavailable tile, remove button
├── view-model.ts             # NEW: headerTitle, tileModel, pickMessage, plural (pure, tested)
├── selection.ts              # DELETED (old imperative DOM code)
└── selection.css             # DELETED (styles now live in the theme and sx props)

src/main/windows.ts           # EDIT: selection window gets titleBarStyle 'hiddenInset' and a theme-aware backgroundColor

tests/renderer/
├── selection-view-model.test.ts   # NEW
├── selection-render.test.ts       # NEW: esbuild bundle + renderToString smoke test
└── support/render-entry.tsx       # NEW: renders SelectionApp with a fake api to a string
```

**Structure Decision**: the same single npm project. React and MUI exist **only inside the
selection-window bundle**. The custom-interval window, the main process and `src/core` are not
changed. Item 2 of the request, ignoring videos, needs no change in `src/core`.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| React 19 + MUI 9 + Emotion (6 runtime packages, bundled into the renderer) | The owner required the "material ui framework" (FR-001). MUI needs React and Emotion as peers | Hand-written CSS can't meet FR-001. `@material/web` isn't MUI and lacks the needed components (R1) |
| esbuild (dev dependency) and a build step for the renderer | A sandboxed renderer can't resolve bare `react` / `@mui/*` imports | Vite and webpack are heavier. Import maps don't load React/MUI reliably unbundled (R2) |
| CSP `style-src 'unsafe-inline'` | Emotion injects `<style>` at runtime | A nonce needs per-load HTML rewriting in the protocol handler. Scripts stay `'self'`-only (R3) |
