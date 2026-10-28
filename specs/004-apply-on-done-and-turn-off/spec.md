# Feature Specification: Apply New Photos on Done, and Turn Off

**Feature Branch**: `004-apply-on-done-and-turn-off`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "1- when the user add a photo and click 'done' - we should replance
the wallpaper+screen-saver imidiatly 2- we should have a 'turn off' option in the menu which
disable the extenstion and bring back the default settings"

**Clarified with the owner (2026-10-28)**:
- **Done with new photos** always shows one of them right away, and the rotation **runs** from
  then on, even if it was stopped or paused.
- **Turn off** restores the Mac's wallpaper and screensaver, and removes our screensaver. It
  **keeps** the sign-in, the photos and the settings. The menu then offers **Turn on**.

**Relationship to earlier features**:
- **Feature 001**: this changes what happens after the selection dialog's Done. Today nothing
  changes until the next scheduled change.
- **Features 002 and 003**: unchanged. The photo that Done shows is picked with feature 002's
  random rule, restricted to the newly added photos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New photos show up as soon as I click Done (Priority: P1)

The user opens "Choose Google Photos images…", adds photos, and clicks Done. The wallpaper on
every display changes immediately to one of the photos just added, and so does the screensaver,
if "Use for screensaver" is on. The rotation then carries on at the chosen interval, whether it
was running, paused or stopped before.

**Why this priority**: Without it, adding photos looks like it did nothing until the next
interval, which can be up to a day away.

**Independent Test**: With rotation stopped and a 1-day interval, add 2 photos and click Done.
Within 5 seconds the wallpaper is one of those 2 photos, and the menu shows the rotation as
running.

**Acceptance Scenarios**:

1. **Given** the rotation is running, **When** the user adds photos and clicks Done, **Then**
   within 5 seconds the wallpaper is one of the newly added photos, and the next change is a full
   interval from then.
2. **Given** the rotation is stopped or paused (including paused because the wallpaper was
   changed outside the app), **When** the user adds photos and clicks Done, **Then** a newly
   added photo is shown within 5 seconds, and the rotation is running.
3. **Given** "Use for screensaver" is on, **When** the new photo is shown, **Then** the
   screensaver shows the same photo within 2 seconds.
4. **Given** the new photos are still downloading when Done is clicked, **When** the first of
   them finishes downloading, **Then** it is shown at once. Until then, the current wallpaper
   stays.
5. **Given** the user only removed photos, or added none, **When** they click Done, **Then** the
   wallpaper doesn't change immediately, and the rotation keeps its current state. If the photo
   on screen was removed, the next change happens at its normal time.
6. **Given** every newly added photo fails to download, **When** the downloads end, **Then** the
   rotation carries on with the previously saved photos as usual. If there are none, it stops,
   as before.
7. **Given** the user clicks Cancel instead of Done, **When** the window closes, **Then** nothing
   changes.

---

### User Story 2 - Turn the app off and get my Mac back (Priority: P1)

The user chooses **Turn off** from the menu.
- The rotation stops.
- Each display gets back the wallpaper it had before the app first changed it.
- If the app's screensaver was in use, it is removed, and the user is told how to pick their own
  screensaver again.
- The app stays in the menu bar, still signed in, with the selection and settings kept.

The menu now shows that the app is off and offers **Turn on**. Turn on starts the rotation again.

**Why this priority**: Users need a safe, complete way to stop the app affecting their Mac
without losing their setup.

**Independent Test**:
1. Note the current wallpaper.
2. Start the rotation and turn on the screensaver option.
3. Choose Turn off: the original wallpaper is back, our screensaver is gone from System Settings,
   and the menu shows "Turn on".
4. Choose Turn on: the rotation resumes with the same photos.

**Acceptance Scenarios**:

1. **Given** the app has changed the wallpaper, **When** the user chooses Turn off, **Then**
   within 5 seconds every display that is still showing one of the app's photos shows its
   original wallpaper again.
2. **Given** the user had changed the wallpaper themselves in System Settings, **When** they
   choose Turn off, **Then** that wallpaper is left alone, and only displays still showing one of
   the app's photos are restored.
3. **Given** "Use for screensaver" is on, **When** the user chooses Turn off, **Then** the app's
   screensaver is removed from the Mac, the screensaver stops showing the app's photos, and a
   message explains how to choose a screensaver in System Settings, with a button that opens
   that pane.
4. **Given** the app is off, **When** the user opens the menu, **Then** it shows
   "Turned off — your wallpaper is restored", "Turn on", the account, "Sign out" and "Quit". It
   doesn't show rotation controls or photo selection.
5. **Given** the app is off, **When** the Mac restarts or the app relaunches (for example, at
   login), **Then** it stays off and doesn't touch the wallpaper or screensaver.
6. **Given** the app is off, **When** the user chooses Turn on, **Then** the app records the
   current wallpaper as the new "original", shows a random saved photo within 5 seconds, and runs
   the rotation. If "Use for screensaver" was on before, the screensaver is reinstalled, and the
   user is guided to select it again.
7. **Given** the app is off, **When** the user chooses Sign out, **Then** the sign-out works as
   before. The app stays off after the next sign-in until the user chooses Turn on.

---

### Edge Cases

- **The original was never recorded**: if the app had already changed the wallpaper before this
  feature existed, Turn off sets the macOS default wallpaper.
- **A display connected after recording**: it has no recorded original, so Turn off sets the
  macOS default wallpaper on it.
- **The original was a dynamic or Aerial wallpaper**: it is restored as far as macOS allows. If
  macOS won't restore it, the user is told to re-select it in System Settings → Wallpaper.
- **Spaces**: only the active Space of each display can be restored, which is the same macOS
  limit as setting the wallpaper. Other Spaces keep the app's last photo until the user visits
  them, at which point the helper restores them too.
- **Turn off while a pick is in progress**: the pick is cancelled, and the selection window
  closes without saving.
- **Turn off when the helper isn't running**: the restore is retried when the helper restarts,
  and the menu still shows the app as off.

## Requirements *(mandatory)*

### Functional Requirements

**Done applies immediately**

- **FR-001**: When the user clicks Done and the saved selection gained at least one new photo, the
  app MUST show one of the newly added photos on every display within 5 seconds of it being
  available. It is picked at random among the newly added photos that are saved, using feature
  002's rule.
- **FR-002**: That change MUST also update the screensaver when "Use for screensaver" is on.
- **FR-003**: After that change, the rotation MUST be running, whatever its state before, and the
  next change MUST be due one full interval later.
- **FR-004**: If no newly added photo has finished downloading when Done is clicked, the app MUST
  show the first one that finishes, as soon as it finishes. If none finishes successfully, the
  rotation MUST carry on as feature 001 describes.
- **FR-005**: Done without newly added photos, and Cancel, MUST NOT change the wallpaper
  immediately or change the rotation state.

**Turn off and Turn on**

- **FR-006**: The app MUST record each display's wallpaper just before it first changes it, and
  again each time the user chooses Turn on. These are the "originals".
- **FR-007**: The menu MUST offer "Turn off" while the app is on.
- **FR-008**: Turn off MUST:
  - stop the rotation
  - stop re-applying photos on Space changes
  - set every display that is showing one of the app's photos back to its original, or to the
    macOS default when there is none
- **FR-009**: When "Use for screensaver" was on, Turn off MUST:
  - make the screensaver stop showing the app's photos
  - remove the app's screensaver from the user's screensavers
  - show a message, with a button that opens Screen Saver settings, so the user can choose
    another screensaver
- **FR-010**: Turn off MUST keep the sign-in, the selection, the saved photos, and all settings,
  including "Use for screensaver" and "Start at login".
- **FR-011**: While off, the app MUST NOT change the wallpaper or screensaver for any reason: not
  for a timer, wake, launch, a display change, a Space change, or a finished download.
- **FR-012**: While off, the menu MUST show the off status, "Turn on" (disabled when no photo is
  saved), the account, "Sign out" and "Quit", and nothing else.
- **FR-013**: The on/off state MUST survive quitting the app and restarting the Mac.
- **FR-014**: Turn on MUST record new originals, show a random saved photo, and run the rotation.
  When "Use for screensaver" is on, it MUST also reinstall the app's screensaver and guide the
  user to select it, as feature 001 FR-021 does.

### Key Entities

- **Power state**: on or off. Kept with the app's settings.
- **Original wallpapers**: one entry per display, for the wallpaper that display showed before
  the app changed it. Recorded on first use and on Turn on.
- **Pending show**: the newly added photos waiting for their download to finish, so that the
  first one ready is shown. This lives only while the app runs, and is cleared once a photo is
  shown or none remain pending.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of Done clicks that add photos whose downloads have finished, a newly added
  photo is on screen within 5 seconds.
- **SC-002**: After Turn off, 100% of displays that showed one of the app's photos show their
  original or default wallpaper within 5 seconds.
- **SC-003**: After Turn off, the app makes no wallpaper or screensaver changes over 24 hours
  that include sleep, wake and a restart.
- **SC-004**: Turn off followed by Turn on gets back to a rotating wallpaper with the same
  selection in under 10 seconds, with no sign-in and no re-picking.
- **SC-005**: Users can find the off switch in the menu within 10 seconds, without help.

## Assumptions

- **"Default settings" means the user's own previous settings** (their original wallpaper and a
  screensaver they choose), not macOS factory defaults. The macOS default wallpaper is only used
  when no original was recorded.
- **The screensaver can't be selected by an app on macOS 14 and later.** Turn off can remove
  ours and point the user to settings, but it can't pick the previous screensaver for them. This
  is the same limit as feature 001 FR-021.
- **"Start at login" isn't turned off by Turn off.** The app launches in the off state and stays
  off until Turn on.
- **Only "Done with newly added photos" triggers the immediate change.** Removing photos or
  changing the interval doesn't.
