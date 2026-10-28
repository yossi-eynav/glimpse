# Research: Terms of Service and Privacy Policy

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-28

## R1. Data inventory (the facts the privacy policy must match, from the code)

**Checked against the code on 2026-10-28.** Re-check before publishing if the app changes.

| What | Where | Why | Deleted when |
|------|-------|-----|--------------|
| Google account **email** | `state.json` (`account.email`) | Shown in the menu | Sign out |
| **OAuth tokens** (access and refresh) | `tokens.bin`, encrypted with Electron `safeStorage`, using a key in the macOS Keychain | Calling Google on the user's behalf | Sign out, which also revokes the token at Google |
| **Picked photo copies**, at screen size | `Photos/<id>.jpg` | Wallpaper; offline rotation | Removing the photo; Sign out |
| **Thumbnails**, 256 px | `Thumbs/<id>.jpg` | The selection window | Removing the photo; Sign out |
| **Selection metadata**: Google photo IDs, pixel size, creation time, status | `state.json` (`selection`) | Rotation | Removing the photo; Sign out |
| **Settings and rotation state** | `state.json` | The app's behavior | Uninstalling the app (see "All local files" below) |
| **Original wallpaper paths** (feature 004) | `state.json` (`original`) | Turn off puts them back | Overwritten on Turn on. Otherwise kept until the app is uninstalled |
| **Screensaver copy of the current photo** | `~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper/current.jpg` + `manifest.json` | The screensaver shows it | Turning the screensaver option off; Turn off; Sign out (fixed in T004–T006, R2) |
| **Installed screensaver bundle** | `~/Library/Screen Savers/PhotoWallpaperSaver.saver` | The screensaver | Turn off (feature 004) |
| **Logs** | Process console only. Tokens, codes and secrets are redacted (`src/core/log.ts`) | Diagnostics | Not stored in files |

**All local files**: `state.json`, `tokens.bin`, and the `Photos/` and `Thumbs/` folders live in
`~/Library/Application Support/<app name>/`. That's "Google Photos Wallpaper" today, and becomes
"Glimpse" after the rename.

**Network**: the app talks to Google only. There are no developer servers, analytics, crash
reporting, or advertising SDKs. The calls are:
- `accounts.google.com`: sign-in, in the user's own browser
- `oauth2.googleapis.com`: tokens and revoke
- `photospicker.googleapis.com`: picker sessions and the list of picked items
- `lh3.googleusercontent.com`: downloading the picked photos and thumbnails
- the Google Photos picker page, in the user's browser

A local loopback server on `127.0.0.1` runs only during sign-in, to receive Google's redirect.

**Scopes**: `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`, `openid` and
`email`. Sign-in refuses to finish if the Photos permission isn't granted.

## R2. The deletion gap for the screensaver copy: **Resolved (T004–T006, 2026-10-28)**

- **Finding**:
  - `signOut()` deletes `Photos/` and `Thumbs/` and the tokens, but **not** the screensaver
    handoff's `current.jpg`.
  - `handoff.disable()` rewrites `manifest.json` but keeps `current.jpg`.
  - So a copy of the last photo stays on disk after Sign out, after turning the screensaver
    option off, and after Turn off.
- **Decision**: fix it in this feature, so the policy can truthfully say "Sign out deletes every
  copy of your photos".
  - `handoff.disable()` also deletes `current.jpg`, after writing the disabled manifest.
  - `signOut()` calls `handoff.disable()` when a handoff is present.

  Both are test-first (Constitution I).
- **Rationale**: FR-004 requires the documents to match the app. The alternative, documenting a
  leftover copy, is worse for users and for Google's review.
- **Alternatives considered**: Writing "a copy of your last photo may remain in the screensaver
  folder" into the policy. That's accurate, but it's an avoidable privacy weakness.

## R3. Google's required wording and policy contents

- **Decision**:
  - **Limited Use**: the privacy policy uses Google's standard Limited Use disclosure, in its
    usual published form: **"Glimpse's use and transfer to any other app of information received
    from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements."**
  - **Spec wording**: spec FR-010 is updated to this word order.
  - **What Google's OAuth verification looks for**, all of which the policy covers:
    - how the app accesses, uses, stores and shares Google user data
    - retention and deletion
    - the policy hosted on the app's verified domain, linked from the homepage and from the
      consent screen
- **To verify (task)**: the exact sentence against Google's current "Limited Use" help page. It
  couldn't be fetched during planning, because the network lookup failed.
- **Alternatives considered**: paraphrasing the disclosure. Reviewers check for the standard
  sentence.

## R4. Format and placement

- **Decision**:
  - `PRIVACY.md` and `TERMS.md` at the repository root, in GitHub-flavored Markdown, with a front
    block giving the title, the product, the publisher, the contact, and "Last updated:
    2026-10-28".
  - The README gets a "Legal" section linking to both.
  - Publishing them at URLs on a verified domain is the owner's step, outside this repository.
- **Rationale**: plain Markdown renders on GitHub and converts to HTML for a website as-is.
- **Alternatives considered**:
  - **HTML pages**: the owner asked for Markdown files.
  - **One combined document**: Google's consent screen asks for separate privacy and terms URLs.

## R5. Readability targets

- **Decision**:
  - Short sections in second person ("you", "we").
  - Sentences of about 20 words or fewer on average.
  - A one-paragraph summary at the top of the privacy policy.
- **Checking it**: a word count with `wc -w`, under 1,500 each. Flesch Reading Ease is checked by
  a small Node script in the quickstart, with no new dependency: syllables are estimated with a
  simple vowel-group heuristic, which is enough to tell whether the text is about 50 or above.
