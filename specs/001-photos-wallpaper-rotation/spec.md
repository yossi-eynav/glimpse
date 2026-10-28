# Feature Specification: Google Photos Wallpaper & Screensaver Rotation

**Feature Branch**: `001-photos-wallpaper-rotation`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "This is a desktop app for macos that allow the user to select an album / specific photos and configure an interval which will change the wallpaper and screensaver to the relevant image."

**Amendment (2026-10-27)**: "The app should be reachable from the top menu in macOS. All the
options should be visible there. When the user is logged out, the only option is to sign in.
After that they can edit all the relevant config. When the user selects 'Choose Google Photos
images' we will open a dialog that allows them to run the selection."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and rotate the wallpaper from the menu bar (Priority: P1)

The app lives in the macOS menu bar (the top menu). When the user is signed out, its menu offers
only "Sign in with Google". After signing in, the menu shows every option the app has. The user
picks "Choose Google Photos images…", which opens a selection dialog where they choose individual
photos or all the photos in an album. They then pick an interval (for example, every 30 minutes)
from the menu and start the rotation. The wallpaper changes right away and then again each time
the interval passes, with no further action from the user.

**Why this priority**: This is the core value of the product. Without it nothing else matters,
and on its own it is a complete, useful app.

**Independent Test**: From the menu bar, sign in, choose 3 photos in the selection dialog, pick a
1-minute interval, start the rotation, and watch the wallpaper change to each chosen photo in
turn over 3 minutes.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** the user looks at the macOS menu bar, **Then** the
   app's icon is there and clicking it opens the app's menu. The app has no Dock icon and no
   main window.
2. **Given** the user is signed out, **When** they open the menu, **Then** the only option is
   "Sign in with Google" (plus "Quit"). No configuration options are shown.
3. **Given** the user is signed out, **When** they choose "Sign in with Google" and finish
   signing in, **Then** the menu shows the full set of options described in FR-003.
4. **Given** the user is signed in, **When** they choose "Choose Google Photos images…",
   **Then** a selection dialog opens where they can choose individual photos.
5. **Given** the selection dialog is open, **When** the user browses to an album and chooses all
   of its photos, **Then** every photo in that album is added to the selection.
6. **Given** the user has finished choosing in the dialog, **When** they confirm, **Then** the
   dialog closes and the menu shows the number of photos selected.
7. **Given** a selection of at least one photo, **When** the user picks an interval in the menu
   and chooses "Start rotation", **Then** the wallpaper changes to a selected photo within
   5 seconds.
8. **Given** the rotation is running, **When** the interval elapses, **Then** the wallpaper
   changes to a different selected photo (if the selection has more than one photo), on every
   connected display.
9. **Superseded by feature 002 (fully random picks):** each change picks a random saved photo, never the one on screen.
   ~~**Given** the rotation has shown every selected photo once, **When** the next change is due,
   **Then** a new round begins, and no photo repeats within a round.~~

---

### User Story 2 - Screensaver shows the current photo (Priority: P2)

From the menu, the user turns on "Use for screensaver". When the Mac's screensaver starts, it
shows the same Google Photos image that is currently the wallpaper, and it changes when the
wallpaper does.

**Why this priority**: It is half of the requested outcome, but it builds on the selection and
rotation from User Story 1 and adds value only after that works.

**Independent Test**: With a rotation running, turn on "Use for screensaver" in the menu, start
the screensaver, and confirm it shows the current wallpaper photo. Wait for the next interval and
confirm the screensaver shows the new one.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** they turn on "Use for screensaver" in the menu and
   the app's screensaver isn't selected in macOS, **Then** the app explains how to select it.
2. **Given** the option is on and the app's screensaver is selected in macOS, **When** the
   screensaver starts, **Then** it shows the photo that is currently the wallpaper, filling the
   screen.
3. **Given** the screensaver is showing, **When** the rotation interval elapses, **Then** the
   screensaver changes to the new current photo.
4. **Given** the option is off, **When** the wallpaper changes, **Then** the screensaver is not
   affected.

---

### User Story 3 - Control and keep the rotation running from the menu (Priority: P3)

Without leaving the menu, the user can pause and resume the rotation, skip to the next photo,
change the interval, reopen the selection dialog to add or remove photos, turn on start at login,
and sign out. The rotation keeps going after the app restarts or the Mac reboots.

**Why this priority**: These make the app pleasant to live with day to day, but the core
experience works without them.

**Independent Test**: Start a rotation, pause it from the menu, confirm the wallpaper doesn't
change past the interval, resume it, choose "Next photo", then reboot the Mac and confirm the
rotation continues with the same selection and interval.

**Acceptance Scenarios**:

1. **Given** the rotation is running, **When** the user chooses "Pause", **Then** the wallpaper
   stays the same until they choose "Resume", and the menu shows that rotation is paused.
2. **Given** the rotation is running or paused, **When** the user chooses "Next photo",
   **Then** the wallpaper changes immediately and the interval timer restarts.
3. **Given** the rotation is running, **When** the user picks a different interval in the menu,
   **Then** the next change happens after the new interval, counted from the moment of the change.
4. **Given** the user has a selection, **When** they reopen "Choose Google Photos images…",
   **Then** the dialog shows the current selection and lets them add or remove photos. Rotation
   continues with the updated selection. **Superseded by feature 002 (fully random picks):** there are no rounds to keep.
   ~~… without restarting the round for unchanged photos.~~
5. **Given** "Start at login" is on, **When** the user logs in to their Mac, **Then** the app
   starts in the menu bar and the rotation resumes with the saved selection, interval, and
   paused/running state.
6. **Given** the user is signed in, **When** they choose "Sign out", **Then** rotation stops,
   saved photo copies are deleted, and the menu goes back to showing only "Sign in with Google".

---

### Edge Cases

- **No network**: Changes continue using photos already saved on the Mac. Photos not yet saved
  are skipped until the network returns, and the menu shows a notice.
- **Google sign-in expires or is revoked**: Rotation continues with saved photos. The menu shows
  that sign-in is needed again, and "Choose Google Photos images…" asks the user to sign in first.
- **A selected photo becomes unavailable** (deleted from Google Photos, or can no longer be
  fetched): It is skipped and marked in the selection dialog as unavailable. Rotation never stops
  because of one bad photo.
- **Every selected photo is unavailable**: The wallpaper stays on the last good photo, and the
  menu says why rotation has stopped.
- **No photos selected yet**: "Start rotation" is shown but disabled, with a hint to choose
  photos first.
- **Selection dialog cancelled**: The previous selection is kept unchanged.
- **Selection of one photo**: It is set as the wallpaper and stays there. No error is shown.
- **Videos in an album**: Videos are left out of the selection, and the user is told how many
  were skipped.
- **Mac asleep when a change is due**: No catch-up burst. On wake, one change happens if at least
  one interval passed during sleep, and then the normal schedule resumes.
- **Display added or removed while running**: A newly connected display shows the current photo
  within 5 seconds.
- **Portrait photo on a landscape display (or the reverse)**: The photo fills the screen while
  keeping its proportions, cropping evenly around the center.
- **User changes the wallpaper manually in macOS settings**: The app pauses the rotation and the
  menu says so, so it doesn't silently override their choice.
- **Low disk space**: If saving a photo would leave less than 1 GB free, the app stops saving new
  photos and tells the user. Rotation continues with photos already saved.

## Requirements *(mandatory)*

### Functional Requirements

**Menu bar**

- **FR-001**: The app MUST run as a macOS menu bar app: an icon in the menu bar opens its menu,
  and there is no Dock icon and no main window. All of the app's options MUST be reachable from
  this menu.
- **FR-002**: When the user is signed out, the menu MUST show only "Sign in with Google" and
  "Quit".
- **FR-003**: When the user is signed in, the menu MUST show:
  - a status line: rotation running, paused, or stopped, and the time of the next change;
  - the number of photos selected;
  - "Choose Google Photos images…";
  - an interval submenu with the presets and "Custom…";
  - "Start rotation", or "Pause" / "Resume" depending on state;
  - "Next photo";
  - "Use for screensaver" (on/off);
  - "Start at login" (on/off);
  - the signed-in account and "Sign out";
  - "Quit".
- **FR-004**: The menu MUST show any current notice (for example: offline, sign in again, photos
  unavailable, rotation paused because the wallpaper was changed manually) as a line at the top.

**Account & selection**

- **FR-005**: Users MUST be able to sign in with a Google account from the menu, and sign out.
  Signing out MUST stop rotation.
- **FR-006**: Choosing "Choose Google Photos images…" MUST open a selection dialog in which users
  can choose individual photos from their Google Photos library.
- **FR-007**: In the selection dialog, users MUST be able to add all photos of one of their Google
  Photos albums in a single action.
- **FR-008**: The selection dialog MUST show the current selection as thumbnails with a total
  count, and let users remove individual photos or clear the whole selection. Cancelling the
  dialog MUST leave the previous selection unchanged.
- **FR-009**: The app MUST include only still images in the selection and MUST tell users how
  many non-photo items (such as videos) were skipped.
- **FR-010**: The app MUST save a copy of each selected photo on the Mac so rotation works
  without a network connection.
- **FR-011**: When a photo is removed from the selection, or the user signs out, the app MUST
  delete its saved copy from the Mac.

**Rotation**

- **FR-012**: Users MUST be able to set the rotation interval from the menu: presets of 5 min,
  15 min, 30 min, 1 hour, 6 hours, and 1 day, or "Custom…" for any whole number of minutes from
  1 minute to 7 days.
- **FR-013**: The app MUST change the wallpaper on all connected displays to the same photo at
  each interval.
- **FR-014**: **Superseded by feature 002 (fully random picks):** each change picks uniformly at random from the saved photos, never the one on
  screen (see `specs/002-random-photo-picks/spec.md` FR-001 to FR-005).
  ~~The app MUST show photos in random order with no repeats until every photo in the selection
  has been shown once (shuffle per round).~~
- **FR-015**: The app MUST scale each photo to fill the display while keeping its proportions,
  cropping evenly around the center.
- **FR-016**: Users MUST be able to start, pause, and resume rotation, and to skip to the next
  photo immediately. "Start rotation" MUST be disabled while no photos are selected.
- **FR-017**: After the Mac sleeps through one or more intervals, the app MUST make at most one
  change on wake and then resume the normal schedule.
- **FR-018**: If the user changes the wallpaper outside the app, the app MUST pause rotation and
  tell the user.

**Screensaver**

- **FR-019**: The app MUST provide a screensaver that shows the current rotation photo, filling
  the screen in the same way as the wallpaper.
- **FR-020**: While showing, the screensaver MUST update to the new photo when the rotation
  changes.
- **FR-021**: Users MUST be able to turn "Use for screensaver" on or off in the menu. If the app's
  screensaver isn't selected in macOS, the app MUST explain how to select it.

**Persistence & background operation**

- **FR-022**: The app MUST remember the selection, interval, screensaver option, and
  running/paused state across app restarts and Mac reboots.
- **FR-023**: Users MUST be able to turn "Start at login" on or off.

**Errors & privacy**

- **FR-024**: The app MUST skip photos it cannot fetch or display, mark them as unavailable in
  the selection dialog, and continue rotating with the rest.
- **FR-025**: All error notices MUST be non-blocking and MUST say what happened and what the user
  can do.
- **FR-026**: The app MUST request only read access to the photos the user chooses, and MUST NOT
  upload, change, or delete anything in the user's Google Photos library.
- **FR-027**: Photos and account credentials MUST stay on the user's Mac and MUST NOT be sent to
  any party other than Google.

### Key Entities

- **Google Account Connection**: The signed-in Google account; its status (signed in, needs
  sign-in again, signed out). One account at a time. Its status decides which menu is shown.
- **Selection**: The set of photos the user chose for rotation. Each entry records where it came
  from (individually picked or from a named album), whether a copy is saved on the Mac, and
  whether it is available.
- **Selected Photo**: One still image in the selection: its Google Photos identity, a thumbnail,
  the saved copy on the Mac, and its availability.
- **Rotation Settings**: Interval, running or paused, screensaver option on or off, start at
  login on or off.
- **Rotation State**: The current photo, and when the next change is due. **Superseded by feature 002 (fully random picks):** ~~the photos
  already shown in this round~~ are no longer tracked.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can sign in from the menu bar, choose photos, set an interval,
  and see their first Google Photos wallpaper in under 3 minutes.
- **SC-002**: Every option the app has can be reached from the menu bar within 2 clicks of
  opening the menu (the selection dialog counts as one).
- **SC-003**: Wallpaper changes happen within 5 seconds of the scheduled time on every connected
  display, in at least 99% of scheduled changes while the Mac is awake.
- **SC-004**: With no network connection, 100% of scheduled changes still happen using saved
  photos.
- **SC-005**: Over a 7-day run with a 15-minute interval, rotation never stops on its own except
  in the documented cases (paused by user, manual wallpaper change, all photos unavailable,
  signed out).
- **SC-006**: **Superseded by feature 002 (fully random picks):** see feature 002 SC-001 to SC-003 (no back-to-back repeats, fair picks, no
  cycle). ~~Every photo in a selection of N photos is shown exactly once in each round of N
  changes.~~
- **SC-007**: When the screensaver starts, it shows the current wallpaper photo within 2 seconds.
- **SC-008**: A selection of 1,000 photos can be added and fully saved to the Mac in under
  10 minutes on a typical home broadband connection.
- **SC-009**: While idle between changes, the app has no noticeable effect on battery life or
  responsiveness (under 1% average CPU use).
- **SC-010**: At least 90% of test users complete the "sign in, choose an album, and start
  rotation" task on their first attempt without help.

## Assumptions

- **Platform**: macOS only, on currently supported macOS versions. Windows and Linux are out of
  scope.
- **Menu bar only**: The app has no Dock icon and no main window. The only windows are the
  selection dialog, the sign-in flow, and small prompts such as "Custom…" interval entry.
- **"Quit" while signed out**: The signed-out menu also shows "Quit", because a menu bar app with
  no Dock icon needs a way to exit.
- **Selection is a snapshot**: Choosing an album adds the photos it contains at that moment.
  Photos added to the album later in Google Photos are not picked up automatically; the user
  adds them by reopening the selection dialog. This reflects Google's current limits on how
  third-party apps can read a user's library, where the user picks items through a
  Google-provided chooser rather than the app reading albums directly. The selection dialog may
  therefore present Google's chooser for the picking step.
- **One selection, one account**: There is one active selection and one signed-in Google account
  at a time. Multiple named playlists and multiple accounts are out of scope for this feature.
- **Same photo everywhere**: All displays and all macOS desktops (Spaces) show the same photo.
  Different photos per display is out of scope.
- **Display style**: Photos always fill the screen with center cropping. Other styles (fit,
  stretch, tile) are out of scope.
- **Random only**: **Superseded by feature 002 (fully random picks):** every change is a random pick. ~~Rotation order is shuffle per round.~~
  Chronological or manual ordering is out of scope.
- **Photos only**: Videos, Live Photo motion, and animated images are not used; only the still
  image is shown.
- **Screensaver setup**: macOS may require the user to select the app's screensaver once in
  System Settings; the app guides them but cannot do it for them.
- **Storage**: Saved copies are kept at a resolution suitable for the largest connected display,
  not as full-size originals, to limit disk use.
- **Dependency**: The feature depends on the user having a Google account with Google Photos and
  on Google allowing third-party desktop apps to let users pick photos from their library.
