# Research: Sleek Selection Dialog (Material UI) and Video Handling

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-27

Versions were checked on npm on 2026-10-27.

## R1. Which "Material UI"

- **Decision**: **MUI** (`@mui/material` 9.5.0, with `@mui/icons-material` 9.5.0). It runs on
  **React 19.3** (`react` and `react-dom` 19.3.1), and its default styling engine is **Emotion**
  (`@emotion/react` 11.14, `@emotion/styled` 11.14). MUI 9 declares React 17–19 and Emotion 11
  as peer dependencies.
- **Rationale**: "Material UI" is MUI's name, and the owner asked for the framework by name. It
  has the components the spec needs: `ImageList`, `Skeleton`, `Backdrop`, `Snackbar`/`Alert`,
  `Dialog`, `Tooltip` and `Chip`.
- **Alternatives considered**:
  - **`@material/web` 2.5** (Google's Material 3 web components, no React): it isn't "Material
    UI", it has no image-grid, snackbar or skeleton components, and it is in maintenance mode.
  - **Restyling by hand in CSS**: doesn't meet FR-001.

## R2. Bundling the renderer

- **Decision**: **esbuild 0.28** (a dev dependency) bundles `src/renderer/selection/main.tsx` into
  a single ES module, `dist/renderer/selection/selection.js`, minified, with a sourcemap in
  development.
  - The `build` script runs `tsc` for the main process, then
    `node scripts/build-renderer.js`, then `scripts/copy-static.js`.
  - `tsconfig.json` (the emit config) **excludes** `src/renderer/selection/**`, so `tsc` never
    writes a broken file with bare `react` imports.
  - `tsconfig.test.json` (typecheck) still includes it, with `"jsx": "react-jsx"`.
- **Rationale**:
  - Sandboxed renderers can't resolve bare imports such as `react`, so a bundler is required.
  - esbuild is one small dev dependency with no plugins and no config file, and it builds in
    milliseconds.
- **Alternatives considered**:
  - **Vite**: a dev server and plugin system the app doesn't need. Pages already load through
    `app://`.
  - **webpack**: a heavy config.
  - **Import maps over `app://node_modules`**: React and MUI ship CommonJS and ESM mixes that
    don't load reliably unbundled.

## R3. Content-Security-Policy with Emotion

- **Decision**: the new CSP is
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' photo:; font-src 'self'; connect-src 'none'`.
- **Rationale**:
  - Emotion inserts `<style>` elements at runtime, which `style-src 'self'` blocks.
  - **Scripts stay strict**: no inline or remote script. Inline *styles* can't run code.
  - The renderer is sandboxed, isolated with `contextIsolation`, and loads only local `app://`
    content. `connect-src 'none'` makes FR-012 (no network) a rule the browser enforces.
- **Alternatives considered**:
  - **An Emotion nonce** (`createCache({nonce})`, plus a per-load nonce injected by the `app://`
    handler): it works, but needs the protocol handler to rewrite the HTML and the CSP on every
    load, which is more code for a small gain in this threat model.
  - **Pigment CSS** (MUI's zero-runtime engine): needs a build plugin for esbuild that isn't
    stable for MUI 9 yet.

## R4. Look and feel

- **Decision**:
  - **Theme**: one `createTheme` with `colorSchemes: { light, dark }` and the system preference,
    so FR-001's live dark mode comes from `prefers-color-scheme` through MUI's CSS variables.
  - **Type**: the system font, `-apple-system, BlinkMacSystemFont, "SF Pro Text", …`, with no
    Roboto download (FR-012).
  - **Color and shape**: primary color `#0A84FF` (the macOS accent blue), `shape.borderRadius`
    of 10, `Button` without uppercase text, and thumbnails with a radius of 8.
  - **Window**: `titleBarStyle: 'hiddenInset'`, with the header used as the draggable title area
    (`-webkit-app-region: drag`, and `no-drag` on buttons). `backgroundColor` follows
    `nativeTheme.shouldUseDarkColors`, so there's no white flash (SC-001).
- **Rationale**: Material's components with Mac proportions and fonts look sleek on macOS without
  feeling like an Android app.
- **Alternatives considered**:
  - **Stock Material (Roboto, uppercase buttons, purple primary)**: looks out of place on a Mac.
  - **Window vibrancy**: needs a transparent window and affects text rendering. Deferred.

## R5. Large grids

- **Decision**:
  - MUI `ImageList`, with `cols` from the window width (`useMediaQuery` breakpoints: 4 columns
    under 640 px, 5 under 900 px, and 6 above). Square cells with a 6 px gap.
  - Thumbnails use `loading="lazy"` and `decoding="async"`.
  - No virtualization library for now.
- **Rationale**: 256 px JPEG thumbnails loaded lazily keep 1,000–2,000 tiles smooth (SC-002),
  without adding a virtualization dependency (Principle II). If quickstart scenario 6 shows
  stutter, virtualization is the documented next step.
- **Alternatives considered**: `react-window` or `@tanstack/react-virtual`: deferred until
  measured.

## R6. Video handling

- **Finding**: `filterStillPhotos` (feature 001) already keeps only `type === 'PHOTO'` items with
  an `image/*` MIME type. Videos are never added or downloaded, and motion and Live photos come
  through as `PHOTO`. The Picker API has no media-type filter, so Google's picker will still
  *offer* videos.
- **Decision**: behavior stays the same. Only the messaging changes:
  - The pick outcome becomes a transient message (R7), with "1 video" / "N videos" plurals.
  - When a pick contains only videos, the message says "Only photos can be wallpapers. N videos
    were ignored."
  - The permanent header note is removed.
  - The draft view's `skippedNonPhotoCount` is no longer shown in the header. It's still used to
    build the message.
- **Alternatives considered**:
  - **Asking Google to hide videos**: not supported by the Picker API.
  - **Downloading a video's poster frame and using it as a photo**: contradicts the owner's
    "ignore the videos".

## R7. Testing the UI (Principle I)

- **Decision**: there are two layers.
  1. **`src/renderer/selection/view-model.ts`**: pure TypeScript with no React, unit-tested with
     `node:test`. It holds:
     - `headerTitle(view)`
     - `tileModel(photo)`, which returns ready, loading or unavailable, with the thumb URL and
       the label
     - `pickMessage(result)`, which returns `{severity, text}` or `null`
     - `plural(n, word)`
  2. **A render smoke test**: `tests/renderer/selection-render.test.ts` uses esbuild's JS API,
     already a dev dependency, to bundle a small entry that renders `<SelectionApp>` with a fake
     `window.selection`, using `react-dom/server`'s `renderToString`. It then checks the markup:
     - the empty-state text
     - one tile per photo
     - `aria-busy` on loading tiles
     - the "unavailable" label
     - the header count
     - no "videos skipped" text

     That needs no jsdom and no testing library.
- **Rationale**: the behavior (text, states, messages) is fully tested offline. The components are
  checked as rendered markup, with no new test dependencies.
- **Alternatives considered**: jsdom with `@testing-library/react`: two or more more
  dependencies, for interaction tests the smoke test and manual scenarios already cover.
