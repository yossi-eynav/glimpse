---

description: "Task list for Terms of Service and Privacy Policy"
---

# Tasks: Terms of Service and Privacy Policy

**Input**: Design documents from `/specs/005-legal-documents/`

**Prerequisites**: plan.md, spec.md, research.md (R1 data inventory, R2 deletion gap, R3 wording),
data-model.md (metadata and statements L1–L6), contracts/document-outlines.md, quickstart.md

**Tests**: The R2 code fix is test-first (Constitution Principle I): its tests are written and
seen failing before the code changes. The documents themselves are checked by the quickstart
commands (word count, required statements, readability) and by a fact check against R1.

**Organization**: by user story.
- **US1 (P1)**: the Privacy Policy.
- **US2 (P2)**: the Terms of Service.

The R2 fix is foundational, because the privacy policy's deletion promise depends on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: US1, US2

## Fixed values (data-model.md; use them exactly)

| Field | Value |
|-------|-------|
| Product | Glimpse |
| Publisher | the developer of Glimpse, an independent individual developer ("we", "us") |
| Contact | yossi.eynav@gmail.com |
| Last updated | 2026-10-28 |
| Governing law | the State of Israel, with the competent courts of Tel Aviv-Yafo, subject to mandatory consumer-protection law in the user's country |

---

## Phase 1: Setup

- [X] T001 Record the baseline: run `npm test` (230 tests at the time of writing) and
  `npm run typecheck`, and check that both pass.

---

## Phase 2: Foundational (R2: the screensaver copy must be deleted)

**Purpose**: Make "Sign out deletes every copy of your photos" true before the policy says so.

**⚠️ CRITICAL**: US1's deletion section depends on this phase.

- [X] T002 [P] Extend `tests/core/screensaver/handoff.test.ts` with
  `disable deletes the screensaver's copy of the photo`:
  - call `publish('/data/Photos/p1.jpg', 'p1')`, then `disable()`
  - `${DIR}/current.jpg` must no longer exist
  - `manifest.json` must still exist, with `"enabled": false`
- [X] T003 [P] Extend `tests/core/auth/sign-out.test.ts` with
  `sign-out turns off the screensaver handoff`:
  - pass a fake `handoff` (`{publish, disable}`, which records its calls) as a new optional
    `handoff` dependency of `signOut`
  - after `signOut`, `disable` has been called once
  - in the existing tests, which pass no handoff, sign-out still works
- [X] T004 In `src/core/screensaver/handoff.ts`, make `disable` write the disabled manifest and
  then `await deps.fs.remove(join(deps.dir, 'current.jpg'))`. Write the manifest first, so the
  screensaver stops reading the image before it's removed. Makes T002 pass.
- [X] T005 In `src/core/auth/sign-out.ts`:
  - add `handoff?: Handoff` to `deps`, importing the type from `../screensaver/handoff.ts`
  - after `photos.deleteAll()`, run `await deps.handoff?.disable().catch(() => {})`
  - update the doc comment to "deletes every local copy (including the screensaver's)"

  Makes T003 pass.
- [X] T006 Pass the handoff into sign-out in `src/main/main.ts`:
  - hoist the handoff into `const handoff = createHandoffWriter({ fs, dir: defaultHandoffDir(app.getPath('home')), clock: systemClock })`
  - pass `handoff` to `createRotationEngine`
  - change the `signOut` handler to `signOut({ engine, google, tokenStore, photos, handoff })`

  Then run `npm test` and `npm run typecheck`; both must pass.
- [X] T007 Update research R1's table in `specs/005-legal-documents/research.md`. The
  "Screensaver copy of the current photo" row's "Deleted when" cell becomes
  "Turning the screensaver option off; Turn off; Sign out". Mark R2 as **Resolved (T004–T006)**.

**Checkpoint**: No copy of a user's photo survives Sign out.

---

## Phase 3: User Story 1 - A user understands what happens to their photos and account (Priority: P1) 🎯 MVP

**Goal**: `PRIVACY.md`, accurate to R1, with Google's Limited Use statement, written in plain
English.

**Independent Test**: Quickstart automated checks, plus manual checks 1–2: a new reader answers
the 5 US1 questions correctly in under 5 minutes, and there are 0 mismatches against R1.

- [X] T008 [US1] Write `PRIVACY.md` at the repository root, with the 14 sections in
  contracts/document-outlines.md, in that order.
  - **Header**: title `# Glimpse Privacy Policy`, then the lines **Product**, **Publisher**,
    **Contact** (a `mailto:` link) and **Last updated: 2026-10-28**, with the fixed values above.
  - **Facts**: take every fact from research.md R1, written in plain words, using "you", "we" and
    "Glimpse". Include:
    - only the photos you pick in Google's picker, read-only, plus your Google account email and
      sign-in tokens
    - Glimpse can't see the rest of your library, and never uploads, changes or deletes anything
      in it
    - everything is stored only on your Mac: photo copies at screen size, thumbnails, the photo
      IDs and sizes, settings, the wallpaper you had before, and tokens encrypted with a key in
      your macOS Keychain
    - data is sent only to Google; there's no analytics, advertising, tracking or sale
    - Sign out deletes all photo copies (including the screensaver's), thumbnails and tokens, and
      revokes access
    - uninstalling, and deleting `~/Library/Application Support/Glimpse/`, removes the rest
  - **Statements**: include L1 (Limited Use), word for word, as its own paragraph; L2 at the end;
    L3; L4 with both links; and L6.
  - **Children** (under 13), **Your rights** (GDPR/UK/California in one paragraph), and
    **Security**: wording as in the outline, with no absolute guarantees.
  - **Style**: short sentences (about 20 words or fewer on average), no legalese, and under
    1,500 words.
- [ ] T009 [US1] Verify L1 online (needs network access): open Google's OAuth verification help
  pages about the "Limited Use" disclosure, for example
  <https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes>,
  and compare the sentence in `PRIVACY.md` word for word. If Google's current wording differs,
  update `PRIVACY.md`, data-model.md L1 and spec FR-010 to match. Record "verified 2026-10-28"
  (or the date) under R3 in research.md.
- [X] T010 [US1] Fact check (SC-002): go through `PRIVACY.md` sentence by sentence against
  research.md R1, and fix any statement that claims more or less than R1. Cover every R1 row:
  email, tokens, photo copies, thumbnails, selection metadata, settings, original wallpaper, the
  screensaver copy, the screensaver bundle, logs, and the network endpoints. List any fixes in
  `specs/005-legal-documents/quickstart.md` under "Recorded results".
- [X] T011 [US1] Run the quickstart checks for `PRIVACY.md`:
  - `wc -w PRIVACY.md` is under 1,500
  - `grep -c "including the Limited Use requirements" PRIVACY.md` is `1`
  - `grep -n "Last updated: 2026-10-28" PRIVACY.md`, and `grep -n "yossi.eynav@gmail.com" PRIVACY.md`
  - the Flesch one-liner scores 50 or more

  Record the numbers in `specs/005-legal-documents/quickstart.md`. If readability is under 50,
  shorten sentences and replace long words, then run it again.

**Checkpoint**: The privacy policy is ready for legal review.

---

## Phase 4: User Story 2 - A user knows the rules for using the app (Priority: P2)

**Goal**: `TERMS.md`, with the 15 sections in the outline: plain English, Israeli law, the
not-affiliated statement, and a link to the privacy policy.

**Independent Test**: A reader finds each US2 point in under 2 minutes. Quickstart checks pass.

- [X] T012 [P] [US2] Write `TERMS.md` at the repository root, with the 15 sections in
  contracts/document-outlines.md, in that order.
  - **Header**: title `# Glimpse Terms of Service`, with the same header lines as `PRIVACY.md`.
  - **What Glimpse is**: free of charge; rotates photos you pick from Google Photos as your
    Mac's wallpaper and screensaver.
  - **Who can use it**: a Mac and a Google account in good standing; follow Google's terms; be
    old enough for Google services where you live.
  - **Your responsibilities**: the right to display the photos you pick; lawful use.
  - **Dependence**: Glimpse relies on Google services and macOS, which may change or stop
    working.
  - **License**: personal, non-exclusive, non-transferable, revocable. No resale, reverse
    engineering to abuse Google's services, or circumventing their limits.
  - **Privacy**: a link to [Privacy Policy](PRIVACY.md).
  - **No warranty and limitation of liability**: L5 ("as is", "as available", no warranties,
    and liability limited to the maximum extent permitted by law), with mandatory consumer
    rights preserved.
  - **Stopping**: you can stop at any time by signing out and uninstalling; we may stop offering
    Glimpse.
  - **Changes**: the L6 rule.
  - **Governing law**: the fixed value.
  - **Ending**: contact, then L2.
  - **Length**: under 1,500 words.
- [X] T013 [US2] Run the quickstart checks for `TERMS.md`:
  - `wc -w` is under 1,500
  - "Last updated: 2026-10-28" and the contact are present
  - `grep -n "PRIVACY.md" TERMS.md` finds the link
  - `grep -n "Israel" TERMS.md` finds the governing law
  - the Flesch score is 50 or more

  Record the results in `specs/005-legal-documents/quickstart.md`.

**Checkpoint**: Both documents are drafted and checked.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T014 [P] Add a `## Legal` section to the end of `README.md`, with links to
  [Privacy Policy](PRIVACY.md) and [Terms of Service](TERMS.md), and one sentence: "Glimpse is
  not affiliated with Google. Google Photos is a trademark of Google LLC."
- [X] T015 Final checks:
  - `npm test` and `npm run typecheck` pass
  - both documents render correctly in a Markdown preview, including headings, links and lists
    (quickstart manual check 4)
  - `grep -rn "Google Photos Wallpaper" PRIVACY.md TERMS.md` finds nothing, because the documents
    use only "Glimpse"
- [ ] T016 Owner steps (needs a person, outside the repository):
  - quickstart manual check 1: the reader test (SC-001)
  - quickstart manual check 3: Sign out leaves no `current.jpg`
  - a lawyer's review of both documents
  - publishing them at stable URLs on your verified domain, and entering those URLs on the Google
    OAuth consent screen (Branding → Privacy policy and Terms of service links)

---

## Dependencies & Execution Order

- **T001** comes first.
- **Foundational**: T002 and T003 are [P]. T004 needs T002, and T005 needs T003. T006 needs T004
  and T005. T007 needs T006.
- **US1**: T008 needs T007, because the deletion wording depends on the R2 fix. T009, T010 and
  T011 come after T008, in that order.
- **US2**: T012 can start once Phase 2 is done, in parallel with US1 (it's a different file).
  T013 needs T012.
- **Polish**: T014 is [P], after T008 and T012. T015 needs T011, T013 and T014. T016 is last.

### Parallel Opportunities

- T002 and T003, the foundational tests.
- T008 (`PRIVACY.md`) and T012 (`TERMS.md`).
- T014, alongside the checks.

### Parallel Example

```bash
Task: "T008 write PRIVACY.md"
Task: "T012 write TERMS.md"
```

---

## Implementation Strategy

### MVP First

1. T001–T007: the deletion fix (small, test-first).
2. T008–T011: the privacy policy, which is what Google's verification needs most.
3. **Stop and check**: the fact check and the automated checks pass.

### Incremental Delivery

1. The privacy policy (MVP).
2. The terms of service.
3. README links, then the owner's legal review and hosting.

---

## Notes

- **Drafts, not legal advice**: T016's lawyer review is required before relying on the documents.
- **The rename**: the app itself still uses the name "Google Photos Wallpaper" in its windows and
  data folder. The documents describe the app as Glimpse, and its folder as
  `~/Library/Application Support/Glimpse/`. Rename the app before publishing, or adjust that
  path in `PRIVACY.md`.
