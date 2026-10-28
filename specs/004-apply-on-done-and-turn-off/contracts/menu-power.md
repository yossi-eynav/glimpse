# Contract Delta: Menu (Turn off / Turn on)

This extends [feature 001's menu-ui contract](../../001-photos-wallpaper-rotation/contracts/menu-ui.md).

## Signed in, power on: one new item

The **Turn off** item (id `turnOff`) is added in the group before the account, after
"Start at login":

```text
├── ✓ Use for screensaver
├── ✓ Start at login
├── ─────────
├── Turn off                            id: turnOff   ← NEW
├── ─────────
├── <email>
├── Sign out
└── Quit
```

All other items are unchanged.

## Signed in, power off (FR-012)

The whole menu is:

```text
[tray icon]
├── Turned off — your wallpaper is restored     label (disabled)
├── ─────────
├── Turn on                                     id: turnOn; disabled when no photo is saved
├── ─────────
├── <email>                                     label (disabled)
├── Sign out                                    id: signOut
└── Quit                                        id: quit
```

No notices are shown while the app is off, except `needsReauth`, which is still shown first and
clickable, so the user knows to sign in again before choosing Turn on.

## Signed out

Unchanged: "Sign in with Google" and "Quit". The power state is kept: if it was `off`, the app
stays off after signing in.

## Messages

| When | Shown with | Text |
|------|------------|------|
| Turn off, with `useForScreensaver` on | Non-blocking `dialog.showMessageBox`, with the buttons **Open Screen Saver Settings** and **OK** | "Glimpse is turned off and your wallpaper is restored. Your screensaver was reset. Choose a screensaver in System Settings → Screen Saver." Add "If your wallpaper was a moving one, re-select it in System Settings → Wallpaper." when spike S1 shows that Aerials can't be restored |
| Turn on, with `useForScreensaver` on | The existing feature 001 FR-021 message | "Select 'Google Photos Wallpaper' in Screen Saver settings" |

These messages use the product name in effect when they are implemented.
