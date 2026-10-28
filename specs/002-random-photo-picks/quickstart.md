# Quickstart & Validation: Fully Random Photo Picks

## Prerequisites

The same as feature 001 ([quickstart](../001-photos-wallpaper-rotation/quickstart.md)): Node 24,
`npm install`, `config/google.json`, and `npm run build:native`.

## Automated checks

```sh
npm test         # includes tests/core/rotation/random-pick.test.ts (fairness, no repeats, no cycle)
npm run typecheck
grep -rn shownThisRound src tests   # must print nothing
```

## Manual validation scenarios

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| 1 | US1 | Select 3 photos. Choose Change every → Custom… → 1 minute, then Start rotation. Watch about 10 changes, writing down each photo | No change repeats the photo already showing. At least once, a photo comes back before all 3 have been shown, so there's no fixed cycle (SC-001, SC-003) |
| 2 | US1 | Choose "Next photo" 10 times quickly | Every press shows a different photo from the one before |
| 3 | US1 | Select exactly 1 photo and start rotation, then choose "Next photo" | The same photo stays, and no error appears |
| 4 | US1 | Select exactly 2 photos and start rotation | The two photos alternate. This is expected (spec edge case) |
| 5 | US1 | Quit the app with rotation running, open `~/Library/Application Support/Google Photos Wallpaper/state.json`, then relaunch | After the relaunch and the next save, `rotation` has no `shownThisRound` key, and rotation continues |
| 6 | US2 | Turn on "Use for screensaver" and start the screensaver, then wait for a change | The screensaver shows the newly picked photo within 2 s |
