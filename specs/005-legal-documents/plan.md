# Implementation Plan: Terms of Service and Privacy Policy

**Branch**: `005-legal-documents` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-legal-documents/spec.md`

## Summary

This feature writes `PRIVACY.md` and `TERMS.md` at the repository root for **Glimpse**,
published by an independent developer. The contact is yossi.eynav@gmail.com, and the governing
law is Israel's.

Every statement in the privacy policy comes from a data inventory taken from the code
([research R1](./research.md)), and the policy includes Google's Limited Use disclosure, word for
word.

Writing the inventory exposed one gap: the screensaver's copy of the current photo survives
Sign out. That gets a small, test-first code fix first (R2), so the policy can truthfully promise
complete deletion. The README gains a "Legal" section.

## Technical Context

**Language/Version**:
- **Documents**: Markdown (GitHub-flavored).
- **Code fix**: TypeScript 7 in `src/core`, unchanged otherwise.

**Primary Dependencies**: None new.

**Storage**: N/A for the documents. The fix deletes one more file, `current.jpg` in the
screensaver handoff folder.

**Testing**:
- `node:test`, for the R2 fix, with the existing `MemoryFileSystem` and engine fakes.
- Document checks: a word count, a grep for the required statements, and a Flesch score
  ([quickstart](./quickstart.md)).

**Target Platform**: The documents are published on the web by the owner. The app is
unchanged: macOS 14 or later.

**Project Type**: documentation, plus one small fix to the desktop app.

**Performance Goals**: N/A.

**Constraints**:
- Accuracy: 0 mismatches against R1 (SC-002).
- Readability: a Flesch score of 50 or more, and under 1,500 words each (SC-004).
- Not legal advice: the documents are drafts until a lawyer reviews them.

**Scale/Scope**:
- 2 new documents.
- A README section.
- 2 small code edits (`handoff.ts`, `sign-out.ts`) and their tests.
- A one-line change to spec FR-010's wording.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.0) | Status |
|------|-----------------------------------|--------|
| I. Test-First | A failing test before every behavior change | ✅ The R2 fix gets failing tests first: `handoff.disable()` deletes `current.jpg`, and `signOut()` disables the handoff. The documents aren't code; their checks are in the quickstart |
| II. Simplicity | No speculative work; dependencies justified | ✅ No dependencies. The readability check is a short Node one-liner |
| Desktop: credentials | OS secure store | ✅ Unchanged. The documents describe it truthfully |
| Desktop: others | — | ✅ Not affected |

**Pre-design gate**: PASS. **Post-design re-check**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/005-legal-documents/
├── spec.md
├── plan.md
├── research.md                 # R1 data inventory (the source of truth for PRIVACY.md)
├── data-model.md               # metadata + required statements L1–L6
├── quickstart.md
├── contracts/document-outlines.md
├── checklists/requirements.md
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root)

```text
PRIVACY.md                      # NEW
TERMS.md                        # NEW
README.md                       # EDIT: "Legal" section linking both
src/core/screensaver/handoff.ts # EDIT: disable() also deletes current.jpg (R2)
src/core/auth/sign-out.ts       # EDIT: accepts an optional handoff and disables it (R2)
src/main/main.ts                # EDIT: pass the handoff to signOut
tests/core/screensaver/handoff.test.ts
tests/core/auth/sign-out.test.ts
```

**Structure Decision**: the documents go at the root, so they can be linked and published
as-is. The code fix stays in `src/core`, with a one-line change in the main process.

## Complexity Tracking

No constitution violations.
