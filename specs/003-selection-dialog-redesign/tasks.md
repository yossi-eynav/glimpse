---

description: "Task list for Sleek Selection Dialog (Material UI) and Video Handling"
---

# Tasks: Sleek Selection Dialog (Material UI) and Video Handling

**Input**: Design documents from `/specs/003-selection-dialog-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/selection-dialog-ui.md, quickstart.md

**Tests**: REQUIRED (Constitution Principle I). Test tasks come before their implementation and
must be seen failing first. There are two layers (research R7):
1. **View-model unit tests**: `node:test` on pure `.ts`.
2. **A render smoke test**: an esbuild bundle of a `.tsx` entry, rendered with
   `react-dom/server` `renderToString`, then checks on the markup.

Neither needs jsdom or a testing library.

**Organization**: grouped by user story. US1 is the redesign; US2 is the video messaging. Both
change only the selection-window renderer. `src/core`, the IPC and the main-process logic are not
touched, except for one window option in `src/main/windows.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2

## Conventions

- **Renderer code**: `src/renderer/selection/`.
  - `.tsx` is used for React components and is **bundled by esbuild only**. It isn't emitted by
    `tsc`, and Node's type stripping can't run it.
  - Pure logic goes in `.ts` files that `node:test` can import directly.
- **Imports**: relative imports keep their extensions (`.ts` / `.tsx`); esbuild resolves them.
- **Texts**: all user-facing text comes from
  `specs/003-selection-dialog-redesign/data-model.md`. Copy it exactly.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add React, MUI and esbuild, and make the build bundle the selection renderer.

- [X] T001 Install the dependencies, and record the baseline.
  - **First**, run `npm test` and note the pass count (182 at the time of writing).
  - **Runtime**:
    `npm install --save-exact react@19.3.1 react-dom@19.3.1 @mui/material@9.5.0 @mui/icons-material@9.5.0 @emotion/react@11.14.0 @emotion/styled@11.14.1`
  - **Dev**:
    `npm install --save-dev --save-exact esbuild@0.28.2 @types/react@19.3.0 @types/react-dom@19.3.0`
  - **esbuild's install script**: npm 11 blocks install scripts by default. If esbuild's binary
    is missing (`npx esbuild --version` fails), run `npm install-scripts approve esbuild` and
    `npm install` again.
- [X] T002 Update the TypeScript configs:
  - **`tsconfig.json`** (emit): add `"jsx": "react-jsx"` to `compilerOptions`, and
    `"exclude": ["src/renderer/selection/**"]`, so `tsc` never emits the bundled renderer.
  - **`tsconfig.test.json`** (typecheck): keep `include: ["src", "tests"]`, and set
    `"exclude": []`, so the `.tsx` files are type-checked.

  Check that `npm run typecheck` still passes.
- [X] T003 Create `scripts/build-renderer.js`, a Node ESM script that uses esbuild's JS API:
  `build({entryPoints: ['src/renderer/selection/main.tsx'], bundle: true, format: 'esm', platform: 'browser', target: 'chrome140', outfile: 'dist/renderer/selection/selection.js', minify: true, sourcemap: process.env.NODE_ENV !== 'production' ? 'linked' : false, jsx: 'automatic', define: {'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production')}, logLevel: 'warning'})`.
  - In `package.json`, set `"build": "tsc -p tsconfig.json && node scripts/build-renderer.js && node scripts/copy-static.js"`.
  - Create a placeholder `src/renderer/selection/main.tsx` containing only `export {};`, so the
    build runs. T013 replaces it.
  - Run `npm run build` and check that `dist/renderer/selection/selection.js` exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The typed preload API and the render-test harness that both stories use.

- [X] T004 Create `src/renderer/selection/api.ts`. Move the `SelectionApi` type, and its
  `declare global { interface Window { selection: SelectionApi } }`, out of
  `src/renderer/selection/selection.ts` into this file, unchanged. It imports `DraftView` and
  `PickResult` as types from `../../shared/ipc-types.ts`. Run `npm run typecheck`; it must pass.
- [X] T005 Create the render harness.
  - **`tests/support/render-selection.ts`**: exports
    `async function renderSelection(props: {draft: DraftView; picking?: boolean; message?: {severity: 'success' | 'info' | 'warning' | 'error'; text: string} | null; dark?: boolean}): Promise<string>`.
    - On first call, it uses `esbuild.build` with
      `{entryPoints: ['tests/support/render-entry.tsx'], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', outfile: <os.tmpdir()>/pw-render-<pid>.mjs, logLevel: 'error'}`.
    - It dynamically imports the bundle and calls its `render(props)`.
    - It caches the import.
  - **`tests/support/render-entry.tsx`**: exports `render(props)`, which returns
    `renderToString(<SelectionView {...props} handlers={noopHandlers} />)` from `react-dom/server`.
    `SelectionView` is the presentational component T011 adds in
    `src/renderer/selection/SelectionApp.tsx`.

  Until T011 exists, the harness fails. That is expected, and it makes T007 fail first. Pass `confirmClearOpen: false`, `menuAnchor: null` and no-op handlers.

**Checkpoint**: The build bundles the renderer, and the harness exists.

---

## Phase 3: User Story 1 - A polished, modern selection window (Priority: P1) 🎯 MVP

**Goal**: The MUI window from contracts/selection-dialog-ui.md: header and count, a grid with
ready, loading and unavailable tiles, the empty state, the picking overlay, the in-window
"Clear all" dialog, transient messages, live light/dark appearance, an inset title bar, and the
Esc and ⌘↩ shortcuts. Every feature 001 action keeps working.

**Independent Test**: Quickstart scenarios 1–8, 12 and 13, plus `npm test`, which includes the
view-model and render tests.

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T006 [P] [US1] Create `tests/renderer/selection-view-model.test.ts` for
  `src/renderer/selection/view-model.ts`, following data-model.md:
  - **`plural(n, singular, pluralForm)`**: returns `1 photo`, `0 photos`, `2 photos`,
    `1 video` and `3 videos`.
  - **`headerTitle({photos: [], …})`**: returns `No photos yet`, then `1 photo` for 1 photo and
    `12 photos` for 12 photos.
  - **`tileModel` for a `saved` photo**: `{id, state: 'ready', thumbUrl: 'photo://thumb/<encoded id>', label: 'Photo'}`.
    For an id with `/`, the URL uses `encodeURIComponent`.
  - **`tileModel` for `pending`**: `{state: 'loading', thumbUrl: null, label: 'Downloading…'}`.
  - **`tileModel` for `unavailable`**: `{state: 'unavailable', thumbUrl: 'photo://thumb/…', label: 'This photo is unavailable. Remove it, or pick it again.'}`.
  - **`pickMessage`, the US1 rows**:
    - `{kind: 'added', added: 3, skippedNonPhotoCount: 0}` gives
      `{severity: 'success', text: 'Added 3 photos'}`, and `added: 1` gives `Added 1 photo`.
    - `added: 0` with `skipped 0` gives `null`.
    - `cancelled` gives `null`.
    - `timedOut` gives `{severity: 'warning', text: 'The Google Photos picker timed out. Try again.'}`.
    - `needsSignIn` gives
      `{severity: 'warning', text: 'Your Google sign-in expired. Choose "Sign in again" in the menu bar, then try again.'}`.
    - `error` gives `{severity: 'error', text: result.message}`, unchanged.
- [X] T007 [P] [US1] Create `tests/renderer/selection-render.test.ts`, using
  `renderSelection` from `tests/support/render-selection.ts`:
  - **Empty**: an empty draft gives markup containing `No photos yet`,
    `Pick photos in Google Photos to use them as your wallpaper.` and
    `Add from Google Photos`, and no `<img`.
  - **Mixed tiles**: a draft with 2 `saved` photos, 1 `pending` and 1 `unavailable` gives:
    - the header `4 photos`
    - exactly 3 `<img` tags, with `src="photo://thumb/…"`
    - one element with `aria-busy="true"`
    - the unavailable label text
    - 4 `aria-label="Remove photo"` buttons
  - **Picking**: with `picking: true`, the markup contains `Finish choosing in your browser…`
    and a `Cancel` button inside the backdrop.
  - **Message**: with `message: {severity: 'error', text: 'boom'}`, the markup contains `boom`.
  - **Footer**: the footer has `Cancel` and `Done`.
  - **Dark mode**: rendering with `dark: true` doesn't throw.

### Implementation for User Story 1

- [X] T008 [US1] Create `src/renderer/selection/view-model.ts`: pure TypeScript, with only type
  imports from `../../shared/ipc-types.ts`.
  - `plural`, `headerTitle`, `tileModel`, and `pickMessage` covering the US1 rows exactly as in
    data-model.md.
  - Export the types `TileModel` and `PickMessage`.

  Makes T006 pass.
- [X] T009 [P] [US1] Create `src/renderer/selection/theme.ts`, exporting
  `theme = createTheme({...})` from `@mui/material/styles`:
  - `cssVariables: {colorSchemeSelector: 'media'}`, and
    `colorSchemes: {light: {palette: {primary: {main: '#0A84FF'}, background: {default: '#f5f5f7', paper: '#ffffff'}}}, dark: {palette: {primary: {main: '#0A84FF'}, background: {default: '#1e1e1e', paper: '#2a2a2c'}}}}`
  - `shape: {borderRadius: 10}`
  - `typography: {fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif', button: {textTransform: 'none', fontWeight: 600}}`
  - `components: {MuiButton: {defaultProps: {disableElevation: true}}, MuiTooltip: {defaultProps: {arrow: true}}}`
- [X] T010 [P] [US1] Create `src/renderer/selection/PhotoTile.tsx`, the default export
  `PhotoTile({tile, onRemove}: {tile: TileModel; onRemove(): void})`, using `ImageListItem`
  following contracts/selection-dialog-ui.md:
  - **ready**: `<img src={tile.thumbUrl} alt="" loading="lazy" decoding="async">`, square, with
    `object-fit: cover` and a radius of 8.
  - **loading**: `<Skeleton variant="rounded" animation="wave">`, filling the cell, with
    `aria-busy="true"` and `aria-label={tile.label}`.
  - **unavailable**: the image at opacity 0.35, plus a `WarningAmberRounded` icon at the
    bottom-left, wrapped in `<Tooltip title={tile.label}>`, with `aria-label={tile.label}`.
  - **Remove button, in every state**: an `IconButton size="small" aria-label="Remove photo"`
    with `CloseRounded`, at the top-right. It's shown on hover and focus via `sx` (`opacity: 0`,
    and `1` on `:hover` / `:focus-within`), with a translucent dark background.
- [X] T011 [US1] Create `SelectionView` in `src/renderer/selection/SelectionApp.tsx`: a
  presentational, named export.
  - **Props**: `{draft, picking, message, confirmClearOpen, menuAnchor, handlers}`, where
    `handlers` is `{onAdd, onCancelPick, onRemove(id), onOpenMenu(el), onCloseMenu, onAskClear, onConfirmClear, onCancelClear, onCloseMessage, onCancel, onDone}`.
  - **Layout**: as in the contract.
    - **Header**: `Box` with `-webkit-app-region: drag` and left padding of 80 px for the
      traffic lights. It holds `Typography h6` "Choose photos" and the body2 count from
      `headerTitle`, then the `Add from Google Photos` contained button and the `⋯`
      `IconButton` + `Menu` with "Clear all". Every interactive element gets
      `-webkit-app-region: no-drag`.
    - **Grid**: `ImageList` with responsive `cols` (4/5/6 via `useMediaQuery`) and `gap={6}`,
      mapping `draft.photos` through `tileModel` to `PhotoTile`.
    - **Empty state**: when there are no photos.
    - **Footer**: `Cancel` / `Done`.
    - **Overlays**: the `Backdrop` when picking, the `Dialog` for the clear-all confirmation,
      and the `Snackbar` + `Alert` for messages.
  - **No side effects**: `SelectionView` makes no IPC calls.
- [X] T012 [US1] Add `SelectionApp({api}: {api: SelectionApi})`, the default export, to the same
  `src/renderer/selection/SelectionApp.tsx`. It holds the state from data-model.md: `draft`,
  `picking`, `confirmClear`, `menuAnchor`, `message`.
  - **On mount**: `api.getDraft()`, and subscribe to `api.onDraftChanged`, unsubscribing on
    unmount.
  - **Add**: set `picking`, then `await api.pick()`, then `message = pickMessage(result)`, then
    refresh with `getDraft()`, then clear `picking` in a `finally`.
  - **Actions**: remove and clear call the API and set `draft`. Cancel calls `api.discard()`,
    and Done calls `api.commit()`.
  - **Keyboard**: a `keydown` listener on `window`. `Escape` triggers Cancel, unless the dialog
    or the menu is open, or a pick is running (in that case `cancelPick`). `Meta+Enter` triggers
    Done.
  - Renders `<SelectionView …/>`.

  Makes T007 pass, together with T005's harness.
- [X] T013 [US1] Replace `src/renderer/selection/main.tsx` with the real entry:
  - `createRoot(document.getElementById('root')!).render(<ThemeProvider theme={theme}><CssBaseline enableColorScheme /><SelectionApp api={window.selection} /></ThemeProvider>)`
  - import `./api.ts` for the global type

  Rewrite `src/renderer/selection/index.html` as:
  - the CSP meta, exactly
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' photo:; font-src 'self'; connect-src 'none'`
  - `<title>Choose Google Photos images</title>`
  - `<body><div id="root"></div><script type="module" src="selection.js"></script></body>`
  - no stylesheet link

  Delete `src/renderer/selection/selection.ts` and `src/renderer/selection/selection.css`.
- [X] T014 [US1] Update the selection window in `src/main/windows.ts`:
  - add `titleBarStyle: 'hiddenInset'` to `SIZES.selection`
  - when creating a selection window, set
    `backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f5f5f7'`, importing
    `nativeTheme` from `electron`

  The custom-interval window is unchanged.
- [X] T015 [US1] Check that `npm test` passes (the baseline plus the new tests), and that
  `npm run typecheck` and `npm run build` pass. Then run
  `ls -l dist/renderer/selection/selection.js` and record its size in
  `specs/003-selection-dialog-redesign/quickstart.md`, expecting roughly 300–500 KB. Also check
  that `grep -c "http" dist/renderer/selection/index.html` finds no remote URLs.
- [ ] T016 [US1] Manual check (needs a person): `npm start`, then quickstart scenarios 1–8, 12 and
  13. Record the results in `specs/003-selection-dialog-redesign/quickstart.md`.

**Checkpoint**: The new window is live, and every feature 001 selection action still works.

---

## Phase 4: User Story 2 - Videos are ignored, clearly and quietly (Priority: P2)

**Goal**: One correctly pluralized message for each pick that ignores videos, and no permanent
video note anywhere. Videos are still never added. That is already enforced by `src/core`'s
`filterStillPhotos`, and isn't changed.

**Independent Test**: Quickstart scenarios 9–11, plus the US2 view-model and render tests.

### Tests for User Story 2 ⚠️ write first, confirm they fail

- [X] T017 [P] [US2] Extend `tests/renderer/selection-view-model.test.ts` with the video rows of
  `pickMessage`:
  - `{added: 2, skippedNonPhotoCount: 1}` gives
    `{severity: 'success', text: 'Added 2 photos · 1 video ignored (only photos can be wallpapers)'}`
  - `{added: 1, skippedNonPhotoCount: 3}` gives
    `Added 1 photo · 3 videos ignored (only photos can be wallpapers)`
  - `{added: 0, skippedNonPhotoCount: 2}` gives
    `{severity: 'info', text: 'Only photos can be wallpapers. 2 videos were ignored.'}`
  - `{added: 0, skippedNonPhotoCount: 1}` gives
    `{severity: 'info', text: 'Only photos can be wallpapers. 1 video was ignored.'}`
  - `headerTitle({photos: [one saved photo], skippedNonPhotoCount: 5})` gives exactly `1 photo`,
    with no video text
- [X] T018 [P] [US2] Extend `tests/renderer/selection-render.test.ts`: with
  `draft.skippedNonPhotoCount = 3` and `message = null`, the markup matches neither `/video/i`
  nor `/skipped/i` (spec FR-010).

### Implementation for User Story 2

- [X] T019 [US2] Add the video rows to `pickMessage` in `src/renderer/selection/view-model.ts`,
  exactly as in data-model.md, using `plural` for "video" / "videos" and "video was" /
  "videos were". Makes T017 pass. T018 passes once `SelectionView` never renders
  `skippedNonPhotoCount`; if it fails, remove any such text in
  `src/renderer/selection/SelectionApp.tsx`.
- [X] T020 [US2] Confirm that the core still excludes videos, by checking that these existing
  tests pass unchanged:
  - `keeps only PHOTO items with an image MIME type` in `tests/core/picker/models.test.ts`
  - `pick adds still photos as pending, starts downloads, and cleans up the session` in
    `tests/core/library/selection-session.test.ts`, which expects 4 photos and
    `skippedNonPhotoCount: 1`

  No code change is expected.
- [ ] T021 [US2] Manual check (needs a person): quickstart scenarios 9–11 (photos plus a video,
  only videos, and reopening shows no leftover note). Record the results in
  `specs/003-selection-dialog-redesign/quickstart.md`.

**Checkpoint**: Both stories are done.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T022 [P] In `specs/001-photos-wallpaper-rotation/contracts/menu-ui.md`, replace the body of
  the "Selection dialog (FR-006 to FR-009, research R3)" section with one line:
  "**Superseded by feature 003**: see `specs/003-selection-dialog-redesign/contracts/selection-dialog-ui.md`".
  Keep the old table struck through with `~~…~~`, or remove it.
- [X] T023 [P] Update `README.md`:
  - in "Develop", say that `npm run build` also bundles the selection window (React + MUI)
    with esbuild
  - list the new dependencies in one sentence
- [X] T024 Final checks:
  - `npm test`, `npm run typecheck`, `npm run build` and `npm run build:native` all pass
  - `grep -rl "from 'react'\|@mui" src/core src/main` finds nothing, because React and MUI stay
    in the renderer
  - `grep -rn "videos skipped" src` finds nothing

---

## Dependencies & Execution Order

- **Setup**: T001 → T002 → T003.
- **Foundational**: T004 and T005, after T003. T005's harness compiles only once T011 and T012
  exist.
- **US1**:
  - The tests T006 and T007 are [P].
  - T008 needs T006. T009 and T010 are [P] with T008.
  - T011 needs T008, T009 and T010. T012 needs T011, since it's the same file.
  - T013 needs T012. T014 is independent (main process).
  - T015 needs T013 and T014. T016 needs T015.
- **US2**:
  - T017 and T018 are [P]; both need T008, T011 and T012, which they extend or exercise.
  - T019 needs T017. T020 is independent. T021 needs T019 and T013.
- **Polish**: T022 and T023 are [P], at any time after T013. T024 is last.

### Parallel Opportunities

- T006 and T007, the US1 tests.
- T009 and T010, alongside T008.
- T014 can run alongside any renderer task.
- T017 and T018.
- T022 and T023.

### Parallel Example: User Story 1

```bash
Task: "T006 view-model tests in tests/renderer/selection-view-model.test.ts"
Task: "T007 render smoke test in tests/renderer/selection-render.test.ts"
Task: "T009 theme in src/renderer/selection/theme.ts"
Task: "T010 PhotoTile in src/renderer/selection/PhotoTile.tsx"
Task: "T014 inset title bar in src/main/windows.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Setup and Foundational (T001–T005).
2. US1 (T006–T015): the redesigned window, with tests green.
3. **Stop and check**: T016, the manual scenarios.

### Incremental Delivery

1. US1, the sleek window.
2. US2, the video messaging. It's small and depends only on the view model.
3. Polish: the docs and the final checks.

---

## Notes

- React, MUI and Emotion are bundled into `dist/renderer/selection/selection.js` only. The main
  process, the preloads and `src/core` never import them.
- `src/core/picker/models.ts` (`filterStillPhotos`) is **not** changed. Videos were already
  excluded there.
- Commit after each green step.
