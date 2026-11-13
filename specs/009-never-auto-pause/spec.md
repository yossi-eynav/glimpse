# Feature Specification: Glimpse never pauses on its own

**Feature Branch**: `009-never-auto-pause`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "please remove this feature - Glimpse pauses rotation for one reason: you set a wallpaper yourself. glipse should never pause. only if the user explicitly chose to"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rotation keeps going after a manual wallpaper change (Priority: P1)

A user has Glimpse rotating every 30 minutes. They set a different wallpaper themselves in
System Settings. Glimpse doesn't pause and the menu doesn't say "Paused". At the next scheduled
change, Glimpse shows a new photo from the selection, and rotation goes on as before.

**Why this priority**: This is exactly what was asked: Glimpse stops only when the user tells
it to.

**Independent Test**: Start rotation with a short interval. Set a wallpaper in System
Settings. The menu still shows rotation running, and when the interval ends a Glimpse photo
replaces the manual wallpaper.

**Acceptance Scenarios**:

1. **Given** rotation is running, **When** the user sets a wallpaper in System Settings,
   **Then** rotation stays running, the menu shows no paused status, and the next change stays
   scheduled at the same time.
2. **Given** the user set a wallpaper themselves, **When** the next scheduled change comes,
   **Then** Glimpse shows a photo from the selection on every display, the same as any other
   change.
3. **Given** the user set a wallpaper on only one of several displays, **When** the next
   scheduled change comes, **Then** every display gets the new Glimpse photo.
4. **Given** the user set a wallpaper themselves, **When** they choose "Next photo", **Then**
   a new Glimpse photo is shown right away, as it is today.

---

### User Story 2 - Only the user pauses or stops Glimpse (Priority: P2)

A user wants Glimpse to stop for a while. The only ways to do it are their own choices in the
menu: **Pause**, **Turn off** and signing out. These work exactly as before.

**Why this priority**: The user asked that pausing stays possible when they choose it. This
story makes sure removing the automatic pause doesn't remove the manual one.

**Independent Test**: Choose Pause: rotation stops and the menu shows Resume. Choose Resume:
rotation goes on. Choose Turn off: the original wallpaper comes back.

**Acceptance Scenarios**:

1. **Given** rotation is running, **When** the user chooses Pause, **Then** rotation stops
   until they choose Resume.
2. **Given** rotation is paused by the user, **When** they set a wallpaper in System
   Settings, **Then** Glimpse still stays paused and doesn't touch the wallpaper.
3. **Given** Glimpse is on, **When** the user chooses Turn off, **Then** their original
   wallpaper is restored, as today.

---

### User Story 3 - Users already paused by the old behavior are resumed (Priority: P3)

A user updates Glimpse while it is in the old "Paused — wallpaper changed in System Settings"
state. After the update, Glimpse treats them as running, because they never chose to pause.

**Why this priority**: Only users who update in that state are affected, and it happens once.

**Independent Test**: Start the new version with saved state from the old version in that
paused state. Glimpse shows a photo at launch, the menu shows rotation running, and the next
change is scheduled.

**Acceptance Scenarios**:

1. **Given** saved state from the old version in the "wallpaper changed" paused state,
   **When** the new version starts, **Then** rotation is running: Glimpse shows a photo at
   launch, and the next change is one interval later.
2. **Given** saved state from the old version paused by the user (Pause), **When** the new
   version starts, **Then** it stays paused.

---

### Edge Cases

- **Change between scheduled changes**: the user's wallpaper stays on screen until the next
  scheduled change, "Next photo", or a selection change. Glimpse doesn't revert it the moment
  it appears, including when the user switches Spaces or connects a display.
- **Manual change while paused or off**: nothing happens. Glimpse doesn't touch the wallpaper
  until the user resumes or turns it on.
- **Turn off after a manual change**: as today, Glimpse puts the original wallpaper back only
  on displays still showing a Glimpse photo. Displays showing the user's own choice keep it.
- **No saved photos**: the existing "no photos" state is unchanged. It isn't a pause the user
  chose, but it means there's nothing to show.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Glimpse MUST NOT pause, stop or delay rotation because the user set a wallpaper
  outside the app.
- **FR-002**: When the next scheduled change comes, Glimpse MUST show a new photo on every
  display, whether or not any display shows a wallpaper set outside the app.
- **FR-003**: The menu MUST NOT show the "Paused — wallpaper changed in System Settings"
  status, or any other status saying Glimpse paused itself.
- **FR-004**: Pause, Resume, Turn off, Turn on and sign-out MUST keep working exactly as
  before. Rotation MUST be paused or stopped only by one of these choices.
- **FR-005**: Between scheduled changes, Glimpse MUST NOT immediately overwrite a wallpaper the
  user set themselves.
- **FR-006**: Saved state from an earlier version in the "wallpaper changed" paused state MUST
  load as running. Glimpse MUST show a photo at launch and schedule the next change one
  interval later, as it does today for a launch with an overdue change.
- **FR-007**: The README and any other user-facing text MUST stop saying that Glimpse pauses
  when the user sets a wallpaper.

### Key Entities

- **Rotation state**: running, paused (by the user), stopped, or waiting for photos. The
  "paused because the wallpaper changed" state is removed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the user sets a wallpaper themselves, 100% of scheduled changes still
  happen on time, in automated tests and in manual checks.
- **SC-002**: The only ways rotation pauses or stops are the 3 user choices: Pause, Turn off
  and sign-out.
- **SC-003**: No text in the app or its docs says Glimpse pauses because the wallpaper
  changed.
- **SC-004**: A user updating from the auto-paused state sees a new photo and rotation
  running right after launch, with no action needed.

## Assumptions

- "Never pause" means rotation continues on its normal schedule. Glimpse doesn't revert a
  manual wallpaper at once (FR-005); it simply replaces it at the next scheduled change. This
  is the least surprising choice: the user sees their pick until the interval ends.
- The "no photos" state stays. It isn't a pause; there's simply nothing to show.
- Turn off still restores the originals Glimpse recorded before its first change, and still
  leaves alone displays the user changed themselves.
- No new setting is added to bring the old behavior back.
