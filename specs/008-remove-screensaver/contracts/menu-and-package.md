# Contract: Menu, power actions and package after the screensaver removal

## M1. Signed-in menu (power on), in order

1. Notice (optional)
2. Status line
3. "N photos selected"
4. — separator —
5. Choose Google Photos images…
6. Interval submenu
7. Start / Pause / Resume
8. Next photo
9. — separator —
10. **Start at login** (toggle)
11. — separator —
12. Turn off
13. — separator —
14. Account email
15. Sign out
16. Quit

The `toggleScreensaver` item ("Use for screensaver") is gone. No item id is `toggleScreensaver`,
and no label contains "screensaver", in any state (signed out, signed in, or off).

## M2. Power actions

| Action | Behavior |
|--------|----------|
| Turn off | Close the selection window, then `engine.turnOff()`: rotation stops and the original wallpapers come back. **No dialog** |
| Turn on | `engine.turnOn()`: records the originals, then shows a photo and runs. Nothing is installed |
| Sign out | As before: stop, clear the account and selection, delete photos and thumbnails, clear tokens, revoke. No screensaver step |

## M3. Package contents (`scripts/check-package.sh`)

`Glimpse.app/Contents/Resources/` contains `glimpse-helper` and `google.json`, and **does not**
contain `Glimpse.saver`. The other checks are unchanged: signature, ad-hoc and universal. This
supersedes the `Glimpse.saver` line of `specs/007-ci-release-builds/contracts/distribution.md`
D5.
