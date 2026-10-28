# Contract: Renderer ↔ Main IPC

These are the only bridges between a renderer and the main process. Each preload exposes a
narrow API with `contextBridge.exposeInMainWorld`. Renderers never see tokens, file paths, or
Node APIs. The main process validates every argument it receives.

Shared types live in `src/shared/ipc-types.ts`, which is imported by the main, preload and
renderer code.

## Selection dialog: `window.selection`

Preload: `src/preload/selection.ts`

| Method | Channel (`ipcRenderer.invoke`) | Args | Returns |
|--------|--------------------------------|------|---------|
| `getDraft()` | `selection:getDraft` | — | `DraftView` |
| `pick()` | `selection:pick` | — | `PickResult` |
| `cancelPick()` | `selection:cancelPick` | — | `void` |
| `remove(id)` | `selection:remove` | `id: string` (must be in the draft) | `DraftView` |
| `clearDraft()` | `selection:clear` | — | `DraftView` |
| `commit()` | `selection:commit` | — | `void`, then the main process closes the window |
| `discard()` | `selection:discard` | — | `void`, then the main process closes the window |
| `onDraftChanged(cb)` | `selection:draftChanged` (main → renderer, `webContents.send`) | `DraftView` | Unsubscribe function |

`onDraftChanged` fires as downloads move photos from `pending` to `saved`.

```ts
type DraftView = {
  photos: { id: string; status: 'pending' | 'saved' | 'unavailable' }[];
  skippedNonPhotoCount: number;
};
type PickResult =
  | { kind: 'added'; added: number; skippedNonPhotoCount: number }
  | { kind: 'cancelled' }
  | { kind: 'timedOut' }
  | { kind: 'needsSignIn' }
  | { kind: 'error'; message: string };   // a user-facing message (FR-025)
```

## Custom interval prompt: `window.customInterval`

Preload: `src/preload/custom-interval.ts`

| Method | Channel | Args | Returns |
|--------|---------|------|---------|
| `getCurrent()` | `interval:getCurrent` | — | `{ minutes: number }` |
| `submit(value, unit)` | `interval:submit` | `value: number`, `unit: 'minutes' \| 'hours' \| 'days'` | `{ ok: true }` or `{ ok: false; hint: 'Between 1 minute and 7 days' }` |
| `cancel()` | `interval:cancel` | — | `void` |

## Custom protocol `photo://`

- `photo://thumb/{id}` serves `userData/Thumbs/{id}.jpg`.
- `{id}` must match `^[A-Za-z0-9_-]+$` and belong to the current selection or draft. Anything
  else returns 404.
- No other host or path is served.
