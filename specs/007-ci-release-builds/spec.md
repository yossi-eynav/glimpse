# Feature Specification: Automatic downloadable builds

**Feature Branch**: `007-ci-release-builds`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Lets build a ci-cd flow where on every commit, a github pipeline kicks in and build a distribution so later on users can download it easily. important note -> I don't have apple dev account"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every commit is built and checked automatically (Priority: P1)

The owner pushes a commit to the GitHub repository, and an automated pipeline starts on its
own. It runs the full test suite, then builds the Mac app as downloadable files: a disk image
and a zip. If the tests or the build fail, the run is marked as failed and the owner can see
why. If they pass, the built files are attached to the run, so the owner can download and try
that exact commit.

**Why this priority**: This is the core of the request, and it protects every later release.
A build that is never produced automatically can't be published automatically.

**Independent Test**: Push a commit. Within the time limit, a run appears for that commit,
reports pass or fail, and on success offers a disk image and a zip to download.

**Acceptance Scenarios**:

1. **Given** a commit is pushed to any branch, **When** the push reaches GitHub, **Then** a
   pipeline run starts automatically for that commit, with no manual step.
2. **Given** a run whose tests all pass, **When** it finishes, **Then** it offers a Mac disk
   image and a zip of the app for download, named with the app name, version and commit.
3. **Given** a commit that breaks a test or the build, **When** the run finishes, **Then** it is
   marked failed, it produces no download, and the failing step is visible in the run's log.
4. **Given** a pull request, **When** it is opened or updated, **Then** the same checks run, so
   problems are caught before merging.

---

### User Story 2 - Users download Glimpse from one stable place (Priority: P2)

A user who has never used Glimpse goes to the project's GitHub page and finds a clear download
for the latest version. They download it, drag the app into Applications, and approve it once
in System Settings, because the app isn't notarized by Apple. After that, it opens normally
from then on.

Every commit to the main branch that passes publishes its build as the single **latest**
release, replacing the previous one. Users always get the newest main-branch build. Commits on
other branches, and pull requests, only produce the run downloads from Story 1.

**Why this priority**: This is what users actually reach. It depends on Story 1's builds.

**Independent Test**: On a Mac that has never run Glimpse, follow the README's install steps
from the GitHub page. Glimpse appears in the menu bar within 5 minutes.

**Acceptance Scenarios**:

1. **Given** a main-branch commit passed, **When** a user opens the project's releases page,
   **Then** they see one "latest" release. It has the version, the commit it was built from,
   the date, the disk image and zip, and a short note on how to install.
2. **Given** the downloaded app is in Applications, **When** the user opens it for the first
   time, **Then** macOS offers the "Open Anyway" approval, and does not say the app is
   "damaged". After approving, Glimpse starts.
3. **Given** the app was approved once, **When** the user opens it later, **Then** it starts
   with no further warning.
4. **Given** the user has an Apple silicon Mac or an Intel Mac, **When** they download the one
   file offered, **Then** it runs natively on their Mac.

---

### User Story 3 - Secrets stay secret (Priority: P1)

The app needs the Google sign-in client settings, which the repository deliberately doesn't
contain. The pipeline gets them from the repository's protected secret settings, puts them into
the build, and never prints them or commits them. Builds from forks or from outside
contributors' pull requests never receive the secrets.

**Why this priority**: Leaking the client settings, or committing them, would undo the
repository's existing rule that they stay out of version control. That's as important as the
build itself.

**Independent Test**: Read a completed run's full log. The client settings appear nowhere. The
repository's history still doesn't contain them. A pull request from a fork runs the tests but
doesn't build a signed-in-capable download.

**Acceptance Scenarios**:

1. **Given** the secrets are configured, **When** a run builds the app, **Then** the built app
   can sign in with Google, and the run's log doesn't show the secret values.
2. **Given** the secrets are missing, **When** a run reaches the build, **Then** it fails with
   a clear message naming which setting is missing, instead of producing an app that can't
   sign in.
3. **Given** a pull request from a fork, **When** its run starts, **Then** it runs the tests
   without access to the secrets and produces no download.

---

### Edge Cases

- **No Apple Developer account.** The app can't be signed with a Developer ID or notarized. It
  must still be signed in the free, local way (ad-hoc), so that Apple silicon Macs offer
  "Open Anyway" instead of calling it "damaged". The install note must explain the one-time
  approval.
- **Several quick pushes.** When a newer commit is pushed to the same branch while an older run
  is still going, the older run may be cancelled, so the newest commit's result comes first.
- **Latest is replaced on every main commit.** The previous latest build is no longer offered.
  Users can tell builds apart by the commit shown on the release and in the file names, even
  when the version number hasn't changed.
- **A failed main commit.** It doesn't touch the latest release, which keeps offering the last
  passing build.
- **Two main commits close together.** Each update of the latest release is fully finished
  before the next one starts, so the newest passing commit wins and the release never shows a
  mix of files from two commits.
- **Storage limits.** Per-commit downloads are kept for a limited time (90 days at most), so
  storage doesn't grow without bound.
- **Updating the app.** Each new download is signed differently. After updating, macOS may ask
  once more to allow Glimpse to use its saved sign-in. The install note mentions this.
- **macOS 15 and later.** Right-click → Open no longer bypasses the warning there. The approval
  is in System Settings → Privacy & Security, and the install note must say so.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every push to any branch, and every pull request, MUST start a pipeline run
  automatically.
- **FR-002**: Each run MUST run the full automated test suite, and the type check, before
  building. Any failure MUST stop the run and mark it failed.
- **FR-003**: A successful run MUST produce a Mac disk image and a zip of Glimpse. Each MUST
  run natively on both Apple silicon and Intel Macs.
- **FR-004**: The built app MUST be signed ad-hoc, with no Apple Developer account. After the
  one-time "Open Anyway" approval, macOS MUST open it without calling it damaged.
- **FR-005**: A successful run's files MUST be downloadable from that run for a limited time
  (90 days at most). Their names MUST include the app name, version and short commit ID.
- **FR-006**: Every passing main-branch commit MUST replace the single "latest" release on the
  repository's releases page with its disk image and zip. The release MUST show the version,
  the commit and the build date, and include install notes covering the one-time approval.
  Other branches and pull requests MUST NOT change it. A failed run MUST leave it as it was.
- **FR-007**: The Google sign-in client settings MUST come only from the repository's protected
  secrets. They MUST NOT be printed in logs, committed, or included in any file other than the
  built app.
- **FR-008**: Runs without access to the secrets (for example, fork pull requests) MUST still
  run the tests, and MUST NOT publish a download.
- **FR-009**: If the secrets are missing in a run that should build, the run MUST fail with a
  message naming the missing setting.
- **FR-010**: The README MUST explain how users install Glimpse from the releases page,
  including the one-time approval. It MUST also explain how the owner sets up the secrets.
- **FR-011**: A newer push to the same branch MUST be able to cancel an older run of that branch
  that is still in progress.

### Key Entities

- **Pipeline run**: one automatic execution for one commit. It has a status (running, passed,
  failed, cancelled), a log, and, when it passes, its build files.
- **Build files**: the disk image and the zip from one run. They are named with the app,
  version and commit, and expire after a set time.
- **Latest release**: the one public download on the releases page. It is replaced by each
  passing main-branch commit and shows the version, commit and date, with install notes.
- **Repository secrets**: the Google sign-in client ID and client secret, stored in GitHub's
  protected settings. Only the owner can set them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pushes and pull requests start a run automatically, without any manual
  action.
- **SC-002**: A run for a passing commit finishes, with downloadable files, within 20 minutes.
- **SC-003**: A first-time user on a Mac that has never run Glimpse goes from the GitHub page to
  Glimpse running in the menu bar in under 5 minutes, following only the published install
  notes.
- **SC-004**: 0 occurrences of the client settings in any run log or in the repository history.
- **SC-005**: The downloaded app opens after the one-time approval, on both an Apple silicon
  Mac and an Intel Mac, with 0 "damaged" errors.

## Assumptions

- **No Apple Developer account.** There is no notarization or Developer ID signing, and nothing
  in this feature depends on one. The existing signing and notarizing path, used when Apple
  credentials are set, stays available for the future, but this feature doesn't exercise it.
- **GitHub hosts everything.** The repository is
  [yossi-eynav/glimpse](https://github.com/yossi-eynav/glimpse), and it uses GitHub's own
  pipeline service with its free macOS runners. The repository's public or private status
  affects the free run minutes; this assumes the free allowance is enough.
- **Downloads are free.** No accounts, payment or download tracking.
- **Installers are out of scope.** "Download easily" means a drag-to-Applications disk image
  and a zip. There is no installer package, auto-update or Homebrew formula.
- **Google sign-in access isn't covered.** It is a separate owner step. While the Google
  sign-in screen is in testing mode, only test users the owner adds can sign in. Publishing it
  for everyone needs Google's verification.
- **Version labels.** The version shown comes from the app's version number, which is 0.1.0
  today and is bumped by hand. The commit ID tells builds with the same version apart. There
  are no numbered releases and no history of older builds for users.

## Clarifications

### Session 2026-10-31

- Q: When should a build become a public download? → A: Every passing main-branch commit
  replaces a single "latest" release.
