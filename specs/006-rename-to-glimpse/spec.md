# Feature Specification: Rename the app to Glimpse

**Feature Branch**: `006-rename-to-glimpse`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "I want to change this app name to "Glimpse". check all the references in this repository and change them to Glimpse"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Users see "Glimpse" everywhere the app names itself (Priority: P1)

A user installs and runs the app. Everywhere it shows its own name, it says "Glimpse":
- the app's name in Finder and Applications
- the menu bar tooltip
- notices and error messages
- the page shown in the browser after signing in
- the screensaver's name in System Settings
- the screensaver's own message

The old name "Google Photos Wallpaper" never appears. Wording that refers to Google's own
service ("Choose Google Photos images…", "Add from Google Photos") stays, because it names
Google's product, not this app.

**Why this priority**: The name is the product's identity. The published Privacy Policy and
Terms already say "Glimpse", so the app must match them. Google's branding rules also discourage
third-party apps named after "Google Photos".

**Independent Test**: Build and run the app, then go through sign-in, the menu, Turn off, the
screensaver setup, and a forced start-up error. Every place the app names itself says "Glimpse".

**Acceptance Scenarios**:

1. **Given** the built app, **When** the user looks at it in Finder or Applications, **Then**
   it is called "Glimpse".
2. **Given** the app is running, **When** the user hovers over the menu bar icon, **Then** the
   tooltip says "Glimpse".
3. **Given** the user signs in, **When** the browser shows the "done" page, **Then** the page
   names Glimpse.
4. **Given** the user turns on the screensaver option, **When** they open the Screen Saver
   settings, **Then** the screensaver is listed as "Glimpse", and the guidance notice tells them
   to select "Glimpse".
5. **Given** the user chooses Turn off, **When** the notice appears, **Then** it says Glimpse
   is turned off. If the screensaver runs while the app is off, its message names Glimpse.
6. **Given** the app can't start, or can't start its wallpaper helper, **When** the error box
   appears, **Then** its title names Glimpse.

---

### User Story 2 - The repository uses one name (Priority: P2)

A developer reading or building the project finds "Glimpse" as the product name in:
- the README title and instructions
- the package and app identifiers
- the native components' names and identifiers
- build output names
- code comments, tests and current docs

No live file in the repository still uses the old name or its abbreviations as the product name
("Google Photos Wallpaper", "PhotoWallpaper", the "pw-" prefix for the helper).

**Why this priority**: A mixed name causes confusion and mistakes, such as docs that point at
paths that don't exist. But users never see these internal names, so this comes after Story 1.

**Independent Test**: Search the repository, excluding dependencies, build output, and the
historical feature records (see Assumptions), for the old names. Nothing is found. The full test
suite passes and the app builds.

**Acceptance Scenarios**:

1. **Given** the repository, **When** someone searches it for "Google Photos Wallpaper",
   "PhotoWallpaper", "photowallpaper" and "pw-helper", **Then** there are no matches outside
   the historical feature records.
2. **Given** the renamed project, **When** the developer runs the tests and the build, **Then**
   everything passes and the build output uses the Glimpse names.
3. **Given** PRIVACY.md and the README, **When** they name a folder or file the app creates,
   **Then** that path exists under that name in the renamed app.

---

### User Story 3 - The owner's existing setup after the rename (Priority: P3)

The owner already used the app under its old name on their Mac. After the rename, they launch
Glimpse. It starts fresh: it is signed out and has no photos or settings,
just like a first install. It doesn't read, move or delete anything the old build left behind.
The owner removes the leftovers by hand. Per the owner's later decision, the README doesn't
document this.

**Why this priority**: Only the owner has run the old build, so this affects one person.

**Independent Test**: On a Mac with the old app's data and screensaver installed, launch Glimpse
and check the result against the chosen behavior.

**Acceptance Scenarios**:

1. **Given** a Mac with the old app's data, **When** Glimpse launches for the first time,
   **Then** it is signed out with an empty selection, and the old data folder is left as it was.
2. **Given** the old screensaver is still installed, **When** the owner deletes it by hand,
   **Then** only the Glimpse screensaver is left in Screen Saver settings.

---

### Edge Cases

- **Google's product, not this app.** Text that names Google's service ("Google Photos",
  "Google Photos picker", "your Google Photos library") stays.
- **Old screensaver still installed.** An old screensaver bundle left in the user's screensaver
  folder would show up as a second, broken entry ("Google Photos Wallpaper"). The owner removes it
  by hand (Story 3).
- **Sign-in after the rename.** Saved sign-in data is protected by a key tied to the app's
  name, so the user is asked to sign in again. That's expected, and it is not an error.
- **The screensaver reads a shared folder.** The app and the screensaver exchange the current
  photo through a folder. Renaming that folder must happen on both sides at once, or the
  screensaver shows nothing.
- **The developer's local project folder and the GitHub repository.** The repository is already
  named "glimpse". The developer's local checkout folder name isn't part of the repository, so
  it's out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every place the app shows its own name to users MUST say "Glimpse". That covers
  the app name, the menu bar tooltip, notices, error dialogs, the sign-in done page, the
  screensaver name and the screensaver's messages.
- **FR-002**: Text that names Google's products or services MUST stay as it is.
- **FR-003**: The app's identifiers MUST use the Glimpse name, under the owner's own namespace
  instead of the placeholder "example" one. That covers the package name, the app identifier,
  and the screensaver identifier.
- **FR-004**: The folder where the app keeps its data MUST be named "Glimpse", matching the
  Privacy Policy.
- **FR-005**: The native components MUST be renamed to Glimpse-based names, and every place that
  refers to them MUST match. That covers the wallpaper helper, the screensaver bundle and the
  folder shared with the screensaver. That includes the build, packaging, the app's lookups,
  tests and docs.
- **FR-006**: The README, PRIVACY.md and TERMS.md MUST name the app and its files and folders
  correctly after the rename. Every file path they give MUST be correct for the renamed app.
- **FR-007**: The repository's live files MUST NOT use the old product name or its abbreviations
  ("Google Photos Wallpaper", "PhotoWallpaper", "photowallpaper", "pw-helper"). Live files are
  the source, native code, tests, scripts, configuration and current docs. The historical
  feature records are excluded.
- **FR-008**: All existing behavior MUST work as before the rename. That covers sign-in,
  picking photos, rotation, the screensaver, Turn off and Turn on, and sign-out deletion.
- **FR-009**: Glimpse MUST NOT migrate or delete data left by the old build. It starts like a
  first install. The leftovers are removed by hand and aren't documented in the README.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a walkthrough of every screen, notice and dialog that names the app, 100%
  show "Glimpse" and 0 show the old name.
- **SC-002**: A search of the repository's live files for the four old names returns 0 matches.
- **SC-003**: Every automated test passes after the rename, and the test count is the same as
  before or higher.
- **SC-004**: Every file or folder path named in the README and the Privacy Policy exists under
  that name after a fresh install. 0 broken paths.
- **SC-005**: After the rename, the screensaver shows the current photo the first time it runs.

## Clarifications

### Session 2026-10-31

- Q: What should Glimpse do with the old build's data and screensaver? → A: Start fresh, with no
  migration.
- Update (during implementation): the owner asked to remove the README's "Upgrading from
  Google Photos Wallpaper" section. The clean-up is manual and undocumented, and FR-007 has
  no exception.

## Assumptions

- **Historical feature records stay.** The documents for features 001–005 are records of past
  decisions, so they keep the name they used at the time. Only live files are renamed. This
  feature's own record explains the change.
- **The name is "Glimpse".** That form is used for display names. Identifiers use the lowercase
  "glimpse" with the owner's namespace, for example `com.yossieynav.glimpse`.
- **Users sign in again.** Re-signing in once after the rename is acceptable. The app has no
  users other than the owner yet.
- **"Google Photos" in feature wording stays.** That covers names such as "Choose Google Photos
  images…", which describe the photo source.
- **The constitution is already renamed.** It already says "Glimpse" (v1.0.1). Its leftover
  change-report comment mentions the old title. It isn't governance content, and it can be
  removed as part of this change.
