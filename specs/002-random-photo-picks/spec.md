# Feature Specification: Fully Random Photo Picks

**Feature Branch**: `002-random-photo-picks`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "add randomeness to the image selection"

**Clarified intent (2026-10-27)**: the rotation in feature 001 already shuffles photos in
rounds, with no repeats until every photo has been shown. The owner wants **fully random
picks** instead: each change picks any photo at random, so a photo can come back sooner than
once per round.

**Relationship to feature 001**: this feature **replaces** FR-014 and SC-006 of
[`specs/001-photos-wallpaper-rotation/spec.md`](../001-photos-wallpaper-rotation/spec.md)
(shuffle per round, each photo exactly once per round). Everything else in feature 001 is
unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Each change shows a randomly picked photo (Priority: P1)

A user has a selection of photos and the rotation is running. At each change, whether from the
interval passing, "Next photo", starting the rotation, or waking the Mac, the wallpaper shows a
photo picked at random from the selection.

It is not a shuffled pass through the whole selection, so the order never feels like a
predictable cycle. The same photo is never shown twice in a row, so every change visibly changes
the wallpaper.

**Why this priority**: This is the whole feature. It changes how every wallpaper change picks its
photo.

**Independent Test**: Select 3 photos, set a 1-minute interval, and watch about 10 changes.
Photos appear in no fixed cycle: a photo can come back before all 3 have been shown. No change
ever shows the photo that was already on screen.

**Acceptance Scenarios**:

1. **Given** a selection of at least 2 available photos and a running rotation, **When** the
   wallpaper changes, **Then** the new photo is one of the available photos other than the one
   currently shown, each with the same chance.
2. **Given** a selection of 3 available photos, **When** the rotation makes many changes,
   **Then** a photo may be shown again before every other photo has been shown, because there are
   no rounds.
3. **Given** a selection of exactly 1 available photo, **When** a change is due, **Then** that
   photo stays on screen, and no error is shown.
4. **Given** the user chooses "Next photo", **When** the wallpaper changes, **Then** the same
   random rule applies.
5. **Given** the rotation is restarted, the app is relaunched, or the Mac wakes, **When** the next
   change happens, **Then** it follows the same random rule. No history of earlier picks affects
   the choice beyond excluding the photo on screen.

---

### User Story 2 - The screensaver follows the random pick (Priority: P2)

When "Use for screensaver" is on, the screensaver keeps showing the same photo as the wallpaper,
now chosen by the random rule.

**Why this priority**: It needs no new behavior, only confirmation that the screensaver still
follows the current wallpaper photo whichever way that photo was chosen.

**Independent Test**: With the screensaver on, start it, then let a random change happen. The
screensaver shows the new photo.

**Acceptance Scenarios**:

1. **Given** the screensaver option is on, **When** a random change happens, **Then** the
   screensaver shows the newly picked photo within 2 seconds.

---

### Edge Cases

- **Photos that are pending or unavailable** are never picked. If the randomly picked photo turns
  out to be unavailable when it is about to be shown, it is marked unavailable and another photo
  is picked at random in the same change. This is unchanged from feature 001's FR-024.
- **No photo available**: rotation stops with "Stopped — no photos available", as in feature 001.
- **Exactly 2 available photos**: every change alternates between them, because the photo on
  screen is excluded. This is expected, and not a bug.
- **Selection edited while running**: the next change picks from the updated selection. Removed
  photos are never picked.
- **Photo on screen removed from the selection**: there is nothing to exclude, so the next change
  picks from all available photos.
- **Upgrading from feature 001**: any in-progress shuffle round saved on the Mac is simply ignored.
  The user notices no difference other than the new picking behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: At every wallpaper change, the app MUST pick the next photo uniformly at random from
  the available (saved) photos in the selection. "Every change" means the interval passing,
  "Next photo", starting, resuming, a catch-up change after launch or wake, and re-picking after
  an unavailable photo.
- **FR-002**: When 2 or more photos are available, the app MUST NOT pick the photo currently
  shown.
- **FR-003**: When exactly 1 photo is available, the app MUST keep showing it, without an error.
- **FR-004**: The app MUST NOT use rounds or any history of earlier picks, beyond excluding the
  current photo. A photo MAY be shown again before every other photo has been shown.
- **FR-005**: Photos that are pending or unavailable MUST NOT be picked.
- **FR-006**: The random choice MUST NOT be predictable across runs. Two runs with the same
  selection MUST NOT produce the same sequence, apart from coincidence.
- **FR-007**: This feature replaces feature 001's FR-014 ("random order with no repeats until
  every photo in the selection has been shown once") and SC-006. Feature 001's documentation MUST
  be updated to say so.

### Key Entities

- **Rotation State** (from feature 001): still holds the current photo and when the next change
  is due. It no longer needs the list of photos shown in the current round.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of changes with 2 or more available photos, the new photo differs from the
  previous one.
- **SC-002**: With N available photos (N ≥ 2), over 1,000 changes each photo is shown about
  1,000 / N times, within ±25%. The picks are fair, with no photo favored or starved.
- **SC-003**: With 3 or more available photos, at least one photo comes back before all the
  others have been shown, within 50 changes. This confirms that there is no fixed cycle.
- **SC-004**: Wallpaper changes still happen within 5 seconds of their scheduled time, and the
  screensaver follows within 2 seconds. Feature 001's SC-003 and SC-007 are unchanged.
- **SC-005**: In a short trial, users describe the order as "random" rather than "cycling", and
  never report "the change didn't do anything".

## Assumptions

- **Replace, don't add a setting**: fully random picking replaces shuffle-per-round for everyone,
  with no menu option to choose between them. The owner chose "fully random picks" over adding a
  shuffle toggle.
- **Only the current photo is excluded**: there is no protection against short-range repeats
  (such as A, B, A) beyond not repeating the photo on screen. That was the explicit trade-off
  chosen over shuffled rounds.
- **Equal weight**: every available photo has the same chance. Weighting by date, favorites or
  how recently a photo was shown is out of scope.
- **Unchanged from feature 001**: the timing, the interval options, Spaces, the screensaver, and
  the handling of unavailable photos.
