# Implementation Plan: Automatic downloadable builds

**Branch**: `007-ci-release-builds` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-ci-release-builds/spec.md`

## Summary

One GitHub Actions workflow, `.github/workflows/build.yml`, runs on every push to a branch and
on every pull request. It has three jobs:

1. **`test`**: install, typecheck, then `npm test`. It runs everywhere, including fork pull
   requests, and needs no secrets.
2. **`package`**: build the native pieces, write `config/google.json` from the repository
   secrets, run `npm run make`, check the signature, then upload the dmg and zip as run
   artifacts named with the version and commit. It runs only where secrets are available:
   pushes and same-repository pull requests.
3. **`release`**: only for pushes to `main`. It moves the `latest` tag to the commit and
   replaces the assets and notes of the single `latest` GitHub Release. Runs are serialized,
   so two main commits never mix files.

Without an Apple Developer account, the app is **ad-hoc signed**. A new Forge `postPackage` hook
calls `scripts/adhoc-sign.sh`. Today the packaged bundle's signature is broken: `codesign
--verify --deep --strict` reports "code object is not signed at all". That broken signature is
what makes a downloaded copy show "damaged" instead of "Open Anyway" (research R1).

A small check script, `scripts/check-package.sh`, is the test for that. It is written first
and seen failing on today's output.

## Technical Context

**Language/Version**: GitHub Actions workflow YAML; bash for two small scripts; the app is
unchanged (TypeScript 7 / Node 24.22 / Electron 45, Swift).

**Primary Dependencies**:
- **GitHub-provided only**: `actions/checkout`, `actions/setup-node`,
  `actions/upload-artifact`, and the `gh` CLI that comes preinstalled on runners.
- **No third-party actions**, and no new npm packages.

**Storage**:
- Run artifacts are kept for 30 days.
- One GitHub Release, tagged `latest`, has two assets with stable names.

**Testing**:
- `scripts/check-package.sh`, run locally and in CI, checks:
  - the deep strict signature
  - that the signature is ad-hoc
  - universal architectures
  - the bundled resources
- The existing `npm test` (232 tests) and `npm run typecheck` run in the `test` job.
- Workflow behavior is checked by the quickstart's push and PR scenarios.

**Target Platform**:
- **Builds**: GitHub-hosted `macos-latest` runner (Apple silicon, with Xcode, `swiftc`,
  `lipo`, Python and node-gyp tooling).
- **Downloads**: macOS 14 or later, Apple silicon and Intel (universal).

**Project Type**: build and release pipeline for the existing desktop app.

**Performance Goals**: a full passing run in under 20 minutes (SC-002), using `npm ci` with the
setup-node npm cache.

**Constraints**:
- No Apple Developer ID and no notarization.
- Secrets never printed or committed (FR-007).
- Fork pull requests get no secrets (FR-008).
- `latest` changes only for passing `main` pushes (FR-006).

**Scale/Scope**:
- 1 workflow
- 2 scripts
- 1 Forge hook
- `package.json` `allowScripts`
- README sections (Install, plus CI setup)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.1) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change | ✅ This is build configuration, which is exempt, but the one behavior that matters (a valid signature) still gets a test first. `scripts/check-package.sh` is written and seen failing on today's package before the `postPackage` hook is added. The workflow itself is checked by the quickstart's scenarios |
| II. Simplicity | No speculative work; dependencies justified | ✅ Only GitHub's own actions plus the preinstalled `gh`. Plain `codesign` instead of `@electron/osx-sign` options (R1). No installer, no auto-update, no Homebrew |
| Desktop: credentials | No credentials in plain-text files or logs | ✅ The OAuth client settings come only from repository secrets. They're written to `config/google.json` on the runner, which is ignored and never uploaded on its own, and GitHub masks them in logs. They ship inside the app, as they do today; Google treats a Desktop client secret as not confidential |
| Desktop: packaging | Plan states stack, OSes, packaging | ✅ The same Forge universal zip and dmg as today, now ad-hoc signed and built in CI |

**Pre-design gate**: PASS. **Post-design re-check**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/007-ci-release-builds/
├── spec.md
├── plan.md
├── research.md              # R1–R8
├── data-model.md            # run, artifact, latest release, secrets
├── contracts/distribution.md  # file names, URLs, triggers, secrets: what users and the owner rely on
├── quickstart.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
.github/workflows/build.yml   # NEW: test → package → release
scripts/adhoc-sign.sh         # NEW: codesign --force --deep --sign - <app>, then verify
scripts/check-package.sh      # NEW: the package checks (signature, ad-hoc, universal, resources)
forge.config.js               # EDIT: hooks.postPackage → adhoc-sign.sh when not notarizing
package.json                  # EDIT: allowScripts for fs-xattr and macos-alias (the DMG maker)
README.md                     # EDIT: "Install" (download, Open Anyway, Keychain prompt) and "Continuous builds" (secrets)
```

**Structure Decision**: a single workflow file with three jobs keeps the trigger rules in one
place. The signing logic lives in a script, not in YAML, so it runs the same way locally and in
CI.

## Complexity Tracking

No constitution violations.
