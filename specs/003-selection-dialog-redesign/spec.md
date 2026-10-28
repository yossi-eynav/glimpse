# Feature Specification: Sleek Selection Dialog (Material UI) and Video Handling

**Feature Branch**: `003-selection-dialog-redesign`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "1- make the UI of the 'chose google photos' window a way more
sleak. it should use material ui framework 2- if the user selects a video - ignore the videos"

**Relationship to feature 001**: this redesigns the selection dialog from feature 001 (FR-006 to
FR-009, and `contracts/menu-ui.md` → "Selection dialog"). The dialog's behavior and its IPC are
unchanged. Feature 001 already excludes videos (FR-009); this feature makes that behavior clear
to the user, with no permanent clutter.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A polished, modern selection window (Priority: P1)

The user opens "Choose Google Photos images…". The window looks like a modern Mac app:
- a clean header with the photo count and a prominent "Add from Google Photos" button
- an even grid of rounded thumbnails
- smooth loading placeholders while photos download
- a friendly empty state
- consistent buttons and dialogs that follow the system light or dark appearance

Every action from feature 001 is still there: add, remove one photo, clear all, cancel, done.

**Why this priority**: The owner's main request. This is the window users see most after the
menu.

**Independent Test**: Open the window with 0 photos, then with about 20, then while a pick is in
progress, in both light and dark appearance. Each state matches
[contracts/selection-dialog-ui.md](./contracts/selection-dialog-ui.md), and every action still
works.

**Acceptance Scenarios**:

1. **Given** no photos are selected, **When** the window opens, **Then** it shows an empty state
   with an icon, a short explanation, and an "Add from Google Photos" button.
2. **Given** photos are selected, **When** the window opens, **Then** they appear as an evenly
   spaced grid of square, rounded thumbnails, and the header shows the count ("1 photo",
   "12 photos").
3. **Given** a photo is still downloading, **When** it is shown in the grid, **Then** it appears
   as an animated placeholder until its thumbnail arrives.
4. **Given** a photo is unavailable, **When** it is shown, **Then** it is dimmed and has a warning
   icon, and hovering over it explains why.
5. **Given** the pointer is over a thumbnail, **When** the user clicks its remove button,
   **Then** the photo leaves the grid at once.
6. **Given** the user chooses "Clear all", **When** they confirm in an in-window dialog,
   **Then** the grid empties. Cancelling that dialog changes nothing.
7. **Given** the user chooses "Add from Google Photos", **When** the browser picker is open,
   **Then** the window shows a dimmed overlay with a spinner, "Finish choosing in your
   browser…", and a Cancel button.
8. **Given** a pick finishes, fails, or times out, **When** the window returns, **Then** a short
   message appears at the bottom and fades away on its own.
9. **Given** the Mac is in dark mode, **When** the window opens, **Then** it uses a dark theme.
   If the appearance changes while the window is open, the window follows.
10. **Given** the window is open, **When** the user presses Esc, **Then** it acts as Cancel, and
    when they press ⌘↩ it acts as Done.

---

### User Story 2 - Videos are ignored, clearly and quietly (Priority: P2)

If the user picks videos in Google's picker, together with photos or on their own, the videos
are never added, downloaded, or shown. The user sees one short message saying that videos were
ignored and why, and nothing else.

**Why this priority**: The behavior already works (feature 001, FR-009). What's left is how it's
explained: the old window showed a permanent and wrongly pluralized "1 videos skipped" note, and
"Added 0 photos" when only videos were picked.

**Independent Test**: Pick 2 photos and 1 video, then, in a second round, pick only 2 videos. The
grid only ever shows photos, and each round shows the right single message.

**Acceptance Scenarios**:

1. **Given** the user picks photos and videos, **When** the pick finishes, **Then** only the
   photos are added, and a message says "Added 2 photos · 1 video ignored (only photos can be
   wallpapers)".
2. **Given** the user picks only videos, **When** the pick finishes, **Then** nothing is added,
   and a message says "Only photos can be wallpapers. 2 videos were ignored."
3. **Given** videos were ignored in an earlier pick, **When** the window is reopened, **Then** no
   leftover note about videos is shown.
4. **Given** a picked item is a motion or Live photo, **When** the pick finishes, **Then** it is
   added as a still photo, as before.

---

### Edge Cases

- **Very large selections** (up to about 2,000 photos): the grid scrolls smoothly, and
  thumbnails load as they come into view.
- **Narrow window**: the window can be resized down to its minimum of 560×420. The grid then shows
  fewer columns, and the header buttons stay visible.
- **A pick returns nothing** (the user closed the picker without choosing): nothing is added, and
  no message is shown, the same as Cancel.
- **The window closes during a pick**: the pick is cancelled, as in feature 001.
- **Several messages in a row**: only the newest is shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The selection window MUST be built with the Material UI component framework, using
  one theme for color, type, shape and spacing. It MUST follow the system light or dark
  appearance live.
- **FR-002**: The window MUST provide every feature 001 action: add from Google Photos, remove one
  photo, clear all with confirmation, cancel, and done. The meaning of each is unchanged.
- **FR-003**: The header MUST show a correctly pluralized count: "No photos yet", "1 photo", or
  "N photos".
- **FR-004**: Photos still downloading MUST show an animated placeholder. Unavailable photos MUST
  be dimmed, with a warning icon and an explanatory tooltip.
- **FR-005**: The "Clear all" confirmation MUST be an in-window dialog, not a system alert.
- **FR-006**: While the browser picker is open, the window MUST show a blocking overlay with
  progress, "Finish choosing in your browser…", and Cancel.
- **FR-007**: The outcome of each pick MUST appear as one transient message (about 6 s) with the
  right tone: success, info, warning or error. Error messages MUST keep the specific wording from
  the existing error handling (for example, "Google Photos access was not granted…").
- **FR-008**: Videos and other non-photo items MUST never be added, downloaded, or shown (this
  keeps feature 001's FR-009).
- **FR-009**: When a pick ignores videos, the message MUST say how many were ignored and why,
  with correct singular and plural forms. When a pick has only videos, the message MUST say that
  nothing was added.
- **FR-010**: No permanent "videos skipped" text may appear in the window.
- **FR-011**: Esc MUST act as Cancel, and ⌘↩ as Done.
- **FR-012**: The window MUST keep working offline and with no network fonts. It MUST load
  nothing from the internet.

### Key Entities

- **Draft view** (unchanged, from feature 001's IPC contract): the photos with their status, and
  the number of non-photos skipped in the last pick.
- **Pick outcome** (unchanged): added (with the counts of photos added and items skipped),
  cancelled, timed out, needs sign-in, or error (with a message).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The window opens and shows its first content within 1 second, with no flash of
  unstyled content.
- **SC-002**: With 1,000 selected photos, scrolling stays smooth, with no visible stutter on a
  2020-or-newer Mac.
- **SC-003**: In a 5-person preference check, at least 4 people rate the new window as "looks
  modern" or better, compared with the old one.
- **SC-004**: In 100% of picks that contain videos, no video appears in the grid or as a
  wallpaper, and exactly one message reports the correct number.
- **SC-005**: Every feature 001 selection-dialog scenario (quickstart scenarios 3–4 and 10–11)
  still passes.

## Assumptions

- **Material UI means MUI** (the React component library), as the owner named it. Its
  requirements (React and its styling engine) are accepted.
- **Only the selection window is redesigned.** The small "Custom interval" prompt and the menu bar
  menu are unchanged. Restyling the prompt to match is a possible follow-up.
- **Fonts**: the system font (San Francisco), so the window feels native and needs no font
  download. Material UI's components and layout are used, with Mac-like accents.
- **Videos can't be hidden in Google's own picker.** Google's picker offers no "photos only"
  option, so filtering still happens after the pick.
- **Window size** stays at 720×560 by default, with a 560×420 minimum.
