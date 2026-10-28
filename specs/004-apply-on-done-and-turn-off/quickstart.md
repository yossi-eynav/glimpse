# Quickstart & Validation: Apply New Photos on Done, and Turn Off

## Prerequisites

The same as feature 001 ([quickstart](../001-photos-wallpaper-rotation/quickstart.md)). Run
`npm run build:native` after the helper change.

## Automated checks

```sh
npm test            # engine Done/pendingShow/power tests, menu power tests, helper restore tests
npm run typecheck
npm run build && npm run build:native
```

## Manual validation scenarios

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| 1 | US1 | Rotation stopped, interval 1 day. Choose photos → add 2 → wait for their thumbnails → Done | Within 5 s the wallpaper is one of the 2 new photos. The menu shows "Next change …" about 1 day ahead |
| 2 | US1 | Rotation paused. Add 1 photo → Done | The new photo shows, and the menu shows the rotation running |
| 3 | US1 | "Use for screensaver" on. Add a photo → Done → start the screensaver | The screensaver shows the new photo |
| 4 | US1 | Add 5 photos and click Done **immediately**, before the thumbnails finish | The wallpaper changes as soon as the first of the 5 finishes downloading |
| 5 | US1 | Open the dialog, remove a photo (not the one on screen), Done | No immediate change |
| 6 | US2 | Note your wallpaper. Run the rotation with the screensaver on → Turn off | Your original wallpaper is back within 5 s. The message has an "Open Screen Saver Settings" button. Our screensaver is gone from the list. The menu shows "Turned off — your wallpaper is restored" and "Turn on" |
| 7 | US2 | Rotation running → set a wallpaper yourself in System Settings → Turn off | Your new wallpaper is kept, not replaced by the old original |
| 8 | US2 | Off → switch to another Space that still shows an app photo | That Space gets the original wallpaper back |
| 9 | US2 | Off → quit and relaunch (or reboot with Start at login on) → wait one interval | The app stays off. The wallpaper and screensaver are untouched |
| 10 | US2 | Off → Turn on | Within 5 s a random saved photo shows, and the rotation runs. With the screensaver on: it's reinstalled, with the "select it" message |
| 11 | Spike S1 | Set a dynamic or Aerial wallpaper → Turn on → Turn off | Record whether it comes back moving or as a still frame (research R2) |
| 12 | Spike S2 | With our screensaver selected → Turn off → start the screensaver (hot corner) | Record what macOS shows (research R3) |
