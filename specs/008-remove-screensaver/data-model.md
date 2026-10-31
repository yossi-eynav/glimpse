# Data Model: Remove the screensaver

## RotationSettings (in `state.json` → `settings`)

| Field | Before | After |
|-------|--------|-------|
| `intervalMinutes` | integer, 1 ≤ value ≤ 10080, default 30 | unchanged |
| `useForScreensaver` | boolean, default `false` | **removed** |
| `startAtLogin` | boolean, default `false` | unchanged |

## Loading rules (backward compatibility, FR-005)

- `settings` is built from the known keys only: `intervalMinutes` and `startAtLogin`, each
  falling back to its default when it's missing.
- An unknown key in a saved file, including a legacy `useForScreensaver` with any value, is
  ignored and isn't written back on the next save.
- Nothing else in `state.json` changes: `account`, `selection`, `rotation`, `power` and
  `original`.

## Removed runtime entities

- **Screensaver handoff**: the `current.jpg` + `manifest.json` folder in the legacyScreenSaver
  container. It is no longer written or deleted (FR-008: leftovers are left alone).
- **Installed screensaver bundle** (`~/Library/Screen Savers/Glimpse.saver`): no longer
  installed or removed.
