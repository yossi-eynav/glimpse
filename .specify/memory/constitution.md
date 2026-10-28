<!--
Sync Impact Report
- Version change: (unratified template) → 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] → I. Test-First (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] → II. Simplicity (YAGNI)
- Removed template slots: [PRINCIPLE_3_NAME] … [PRINCIPLE_5_NAME] (project adopts
  two principles; more can be added via MINOR amendment)
- Added sections: Desktop Platform Constraints, Development Workflow, Governance
- Removed sections: none
- Deferred TODOs: none
-->

# Google Photos App Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)

- Every behavior change MUST begin with a test that expresses the expected behavior.
- That test MUST be run and observed failing before any implementation code is written.
- Implementation proceeds Red → Green → Refactor; refactoring happens only with tests green.
- Code that interacts with Google Photos APIs, the OAuth flow, or the local file system MUST be
  covered by tests that run without network access (fakes, stubs, or recorded fixtures).
- A change without a corresponding test is incomplete and MUST NOT be merged. The only exceptions
  are pure documentation, formatting, or build-configuration changes, and the reason MUST be
  stated in the change description.

**Rationale**: Writing the failing test first proves the test can detect the bug or missing
feature, and keeps the design driven by observable behavior instead of implementation details.

### II. Simplicity (YAGNI)

- Build only what a current, written requirement (spec, task, or bug) needs. Speculative
  features, options, and extension points MUST NOT be added.
- Prefer the platform's and standard library's built-in facilities over new dependencies. Every
  new third-party dependency MUST be justified in the plan or change description.
- Prefer the most direct design: no abstraction layer, plugin system, or generic framework until
  at least two concrete uses exist.
- Any deviation from the simplest viable approach MUST be recorded in the plan's Complexity
  Tracking table, listing the simpler alternative and why it was rejected.

**Rationale**: A small, direct codebase is cheaper to test, review, and change. Complexity is
added only when a real requirement pays for it.

## Desktop Platform Constraints

- The product is a desktop application. Features MUST work within a desktop app's lifecycle:
  launch, background and foreground, offline or flaky network, and quit or restart.
- The UI MUST remain responsive. Network calls, media decoding, and large file operations MUST
  NOT block the UI thread.
- OAuth credentials and tokens MUST be stored using the operating system's secure credential
  store, never in plain-text files or logs.
- Each feature's `/speckit-plan` MUST state the desktop stack, supported operating systems, and
  packaging approach it relies on. Once the first plan sets these, a later plan that changes them
  MUST justify the change under Principle II.

## Development Workflow

- Work follows the Spec Kit flow: `/speckit-specify` → `/speckit-clarify` (as needed) →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- Each plan MUST pass the Constitution Check gate (Principles I and II, plus Desktop Platform
  Constraints) before implementation and again after design.
- Tasks MUST order test tasks before the implementation tasks they cover.
- Before a change merges, the full automated test suite MUST pass, and the reviewer MUST confirm
  that tests were written first and that no unjustified complexity was added.

## Governance

- This constitution supersedes all other project practices and guidance. Where another document
  conflicts with it, this constitution wins.
- Amendments are made via `/speckit-constitution`, and MUST include a Sync Impact Report and a
  version bump. A plan or task list that no longer complies with an amendment MUST be updated
  before further implementation.
- Versioning follows semantic versioning:
  - MAJOR: a principle is removed or redefined in a backward-incompatible way.
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications, wording, and typo fixes with no change in meaning.
- Compliance is reviewed at every plan's Constitution Check and at every code review. An
  unresolved violation blocks the merge unless it is justified in Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-27
