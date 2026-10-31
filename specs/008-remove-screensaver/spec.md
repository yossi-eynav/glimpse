# Feature Specification: Remove the screensaver

**Feature Branch**: `008-remove-screensaver`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "remove the screensaver option from the settings. remove the screensaver logic"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The menu no longer offers the screensaver (Priority: P1)

A signed-in user opens the Glimpse menu. There's no "Use for screensaver" option, and nothing
in the app mentions the screensaver. Glimpse only changes the desktop wallpaper.

**Why this priority**: This is exactly what was asked, and it is the only part users see.

**Independent Test**: Sign in and open the menu. No screensaver option appears. Go through
Turn off and Turn on: no notice or dialog mentions the screensaver.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the menu, **Then** there is no screensaver
   option, and every other option is still there and works as before.
2. **Given** Glimpse is running, **When** the user chooses Turn off, **Then** the wallpaper is
   restored and the menu shows that Glimpse is off. No dialog appears: the one that used to
   appear only explained the screensaver reset. Nothing mentions the screensaver.
3. **Given** rotation changes the wallpaper, **When** the photo changes, **Then** only the
   wallpaper changes. Glimpse writes nothing for a screensaver.

---

### User Story 2 - No screensaver code, bundle or docs remain (Priority: P2)

A developer working on Glimpse finds no screensaver logic in the app:
- no screensaver component in the build or the downloadable package
- no code that installs, feeds, or turns off a screensaver
- no screensaver setting

The README, the Privacy Policy and the Terms of Service no longer describe a screensaver
feature.

**Why this priority**: Unused code and docs that describe features that don't exist mislead
users and developers. The Privacy Policy, in particular, must match what the app does.

**Independent Test**: Build and package the app, then confirm the package contains no
screensaver. Search the source, tests and docs: the screensaver feature isn't described
anywhere. All tests pass.

**Acceptance Scenarios**:

1. **Given** the built package, **When** someone inspects it, **Then** it contains no
   screensaver component.
2. **Given** the README, Privacy Policy and Terms, **When** someone reads them, **Then** they
   describe a wallpaper-only app. The Privacy Policy no longer lists a screensaver copy of the
   photo or a screensaver bundle.
3. **Given** the full test suite, **When** it runs, **Then** every test passes, and no test
   refers to the removed screensaver behavior.

---

### User Story 3 - Users who used the screensaver are left clean (Priority: P3)

A user who turned on "Use for screensaver" in an earlier version updates Glimpse. Their Mac
still has Glimpse's screensaver installed and a copy of their current photo in the
screensaver's folder.

The new version leaves them alone. It doesn't delete, move or mention them. The leftovers stay
until the user removes them, and the screensaver may keep showing the last photo it received.

**Why this priority**: Few people used the screensaver before it was removed. The owner chose not
to clean up, to keep the change small.

**Independent Test**: On a Mac with the old screensaver installed and turned on, update to the
new version and launch it. The old screensaver and its photo copy are unchanged.

**Acceptance Scenarios**:

1. **Given** a Mac where an earlier Glimpse installed its screensaver and left a photo copy,
   **When** the new version runs, **Then** the screensaver bundle and the photo copy
   are exactly as they were. Glimpse doesn't read, change or delete them.

---

### Edge Cases

- **Saved settings from an earlier version.** Settings saved with the old screensaver option
  turned on must still load. The option is ignored, the rest of the settings are kept, and the
  app doesn't fail or reset.
- **Screensaver still selected in System Settings.** If the user still had Glimpse's
  screensaver selected and it's gone, macOS falls back to its own default screensaver. Glimpse
  doesn't need to choose one.
- **Turn off and Turn on.** These keep working for the wallpaper exactly as before. They no
  longer do anything to a screensaver.
- **Sign out.** Sign out still deletes every local photo copy, tokens and email, as the Privacy
  Policy promises.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The menu MUST NOT offer a screensaver option. All other menu options MUST keep
  their current behavior.
- **FR-002**: Glimpse MUST NOT install a screensaver, write photos for one, or change any
  screensaver setting.
- **FR-003**: No notice, dialog or other app text may mention the screensaver.
- **FR-004**: The built app and its downloads MUST NOT contain a screensaver component.
- **FR-005**: The setting that turned the screensaver on MUST be removed. Settings saved by
  earlier versions MUST still load, ignoring that setting and keeping all others.
- **FR-006**: Rotation, Change photo, the selection window, Turn off and Turn on, Sign out, and
  start at login MUST work as before for the wallpaper.
- **FR-007**: The README, Privacy Policy and Terms of Service MUST describe Glimpse as a
  wallpaper app only. The Privacy Policy MUST NOT list screensaver data or files, and its "Last
  updated" date MUST change.
- **FR-008**: Glimpse MUST NOT touch leftover screensaver files from earlier versions. It
  doesn't delete them or mention them in the app or the docs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 screensaver options in the menu, and 0 mentions of the screensaver in any app
  text.
- **SC-002**: The downloadable package contains 0 screensaver components.
- **SC-003**: 100% of the remaining automated tests pass. Every non-screensaver behavior that
  was tested before is still tested.
- **SC-004**: Settings saved by the previous version, with the screensaver turned on, load
  without errors on the first launch of the new version, and keep the interval and other
  settings.
- **SC-005**: The Privacy Policy matches the app: every data item it lists exists, and nothing
  the app stores is missing from it.

## Clarifications

### Session 2026-11-01

- Q: What should happen to leftover screensaver files from earlier versions? → A: Leave them,
  with no mention.

## Assumptions

- **Wallpaper only.** Glimpse keeps everything else as it is: choosing photos, rotation, Turn
  off and Turn on, start at login, sign-in.
- **Historical records stay.** The feature records for 001–007 keep describing the screensaver
  as it was. Only live files change.
- **No replacement.** Glimpse won't offer another way to show photos in the screensaver, such as
  pointing users to Apple's built-in photo screensaver.
- **Leftovers are accepted.** On Macs that used the old screensaver, its bundle and the last
  photo copy may stay until the user removes them, and Sign out no longer deletes that copy.
  The owner accepted this. The Privacy Policy describes the current version only.
- **Smaller package.** The package gets smaller, and there's one less native component to
  build and sign.
