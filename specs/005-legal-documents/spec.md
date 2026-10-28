# Feature Specification: Terms of Service and Privacy Policy

**Feature Branch**: `005-legal-documents`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "write a terms of service document and a privacy policy document
(md files)"

**Why now**: Publishing the Google OAuth app ("In production") and passing Google's verification
need a public privacy policy and a homepage, and they usually need terms of service too. The
privacy policy has to describe accurately how the app handles Google user data, and has to
include Google's "Limited Use" disclosure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A user understands what happens to their photos and account (Priority: P1)

Before or after signing in, a user reads the privacy policy and can answer these questions
correctly:
- What does the app access?
- Where are my photos kept?
- Is anything sent to the developer?
- How do I delete everything?
- How do I revoke access?

**Why this priority**: Google verification requires it, it's legally expected, and it's the
document users will actually look for.

**Independent Test**: Give the privacy policy to someone who hasn't seen the app, and ask the 5
questions above. They answer all 5 correctly, in under 5 minutes.

**Acceptance Scenarios**:

1. **Given** the privacy policy, **When** a reader looks for what Google data is accessed,
   **Then** it says, in plain words, that the app gets read-only access to only the photos the
   user picks in Google's picker, plus their Google account email address, and nothing else.
2. **Given** the privacy policy, **When** a reader looks for where data is kept, **Then** it says
   that copies of the picked photos, thumbnails, settings and sign-in tokens are stored only on
   the user's Mac. Tokens are encrypted, with a key held in the macOS Keychain.
3. **Given** the privacy policy, **When** a reader looks for sharing, **Then** it says that no
   data is sent to the developer or to any third party except Google: no analytics, no ads, and
   no tracking.
4. **Given** the privacy policy, **When** a reader looks for deletion, **Then** it explains that
   Sign out deletes all saved photos and tokens and revokes access, and how to revoke access in
   their Google Account settings.
5. **Given** the privacy policy, **When** Google's verification reviewer reads it, **Then** it
   contains the required Limited Use statement, word for word, and its description matches the
   permission the app requests (Google Photos Picker, read-only).

---

### User Story 2 - A user knows the rules for using the app (Priority: P2)

A user reads the terms of service and understands:
- the app is provided as-is
- they are responsible for the photos they choose
- the app depends on Google's services, which can change
- the developer's liability is limited
- how the terms can change and how to contact the developer

**Why this priority**: These are expected for distribution and Google verification, but they
matter less to users than privacy.

**Independent Test**: A reader can find each of the points above in the terms within 2 minutes.

**Acceptance Scenarios**:

1. **Given** the terms, **When** a reader looks for what the app does, **Then** it describes the
   service in one short paragraph that matches the app: wallpaper and screensaver rotation of
   photos the user picks from Google Photos on macOS.
2. **Given** the terms, **When** a reader looks for their obligations, **Then** it says that they
   need a Google account in good standing, must follow Google's terms, and must have the right to
   display the photos they pick.
3. **Given** the terms, **When** a reader looks for warranties and liability, **Then** it states
   an "as is" disclaimer and a limitation of liability in plain language.
4. **Given** the terms, **When** a reader looks for the relationship to Google, **Then** it says
   the app is not made, endorsed, or sponsored by Google, and that Google Photos is a trademark
   of Google LLC.
5. **Given** either document, **When** a reader looks for contact and change details, **Then** it
   shows a "Last updated" date, how changes are announced, and a contact email address.

---

### Edge Cases

- **Older macOS versions, or the app's behavior changing later**: each document says it describes
  the current version, and that updates will change the "Last updated" date.
- **Children**: the privacy policy states the app is not directed to children under 13, and that
  Google's own age rules apply to Google accounts.
- **Users in the EU, UK or California**: the privacy policy covers the rights to access and
  deletion, framed around the fact that the developer holds no personal data at all.
- **Data the developer can't see**: the documents never imply that the developer can read,
  restore, or delete a user's local data. Only the user controls it.

## Requirements *(mandatory)*

### Functional Requirements

**Both documents**

- **FR-001**: Two Markdown documents MUST be produced: a Privacy Policy and Terms of Service. They
  are for publishing at stable public URLs.
- **FR-002**: Each MUST show the product name, the publisher, a "Last updated" date (ISO format),
  and a contact email address.
- **FR-003**: Each MUST be written in plain English, readable by a non-lawyer, with short
  sections and headings.
- **FR-004**: Every factual statement about the app's behavior MUST match the app as built.
  Anything the app doesn't do MUST NOT be claimed, and anything it does MUST NOT be omitted.

**Privacy Policy**

- **FR-005**: It MUST list exactly what is accessed:
  - the photos the user picks through Google's picker, with read-only access
  - the Google account email address
  - the sign-in tokens Google issues
- **FR-006**: It MUST state that the app can't see the rest of the user's Google Photos library,
  and never uploads, changes, or deletes anything in it.
- **FR-007**: It MUST state where data is stored (only on the user's Mac), what is stored (photo
  copies at screen size, thumbnails, settings, encrypted tokens, and the wallpaper that was in
  place before the app changed it), and that nothing is stored on servers run by the developer.
- **FR-008**: It MUST state that the app sends data only to Google, to sign in and to fetch the
  picked photos, and that there is no analytics, advertising, tracking, or sale of data.
- **FR-009**: It MUST explain retention and deletion:
  - removing a photo deletes its copy
  - Sign out deletes all copies and tokens and revokes Google access
  - uninstalling the app and deleting its folder removes everything else
  - access can also be revoked at Google's account permissions page
- **FR-010**: It MUST include Google's Limited Use disclosure, word for word: "Glimpse's use and
  transfer to any other app of information received from Google APIs will adhere to the
  [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
  including the Limited Use requirements." (Wording aligned with Google's standard form in
  research R3.)
- **FR-011**: It MUST cover children, changes to the policy, users' rights (access, deletion,
  objection), and contact.

**Terms of Service**

- **FR-012**: It MUST cover:
  - acceptance of the terms
  - a description of the service
  - eligibility and Google account requirements
  - user responsibilities (rights to the photos, lawful use)
  - the dependence on Google services and on macOS
  - the license to use the app
  - "as is" and no-warranty wording
  - a limitation of liability
  - termination (users can stop at any time by signing out and uninstalling)
  - changes to the terms
  - governing law
  - contact
- **FR-013**: It MUST state that the app is independent and not affiliated with or endorsed by
  Google, and MUST name Google Photos as a trademark of Google LLC.
- **FR-014**: It MUST link to the Privacy Policy.

### Key Entities

- **Publisher**: who offers the app (name, and an individual or a company), and their contact
  email.
- **Product**: the app's public name, which appears on Google's consent screen.
- **Jurisdiction**: the place whose law governs the terms.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time reader answers the 5 privacy questions in US1 correctly in under 5
  minutes.
- **SC-002**: A review of both documents against the app finds 0 statements that don't match its
  behavior.
- **SC-003**: The privacy policy contains the Limited Use statement exactly as Google requires,
  and passes Google's OAuth verification without a request for changes.
- **SC-004**: Each document scores at least 50 on the Flesch Reading Ease scale (plain English),
  and each is under 1,500 words.

## Assumptions

- **Location**: both files go at the repository root as `PRIVACY.md` and `TERMS.md`, so they can
  be linked from the README and published as-is, for example on GitHub Pages or the product
  website.
- **The product is free**: there are no payments, accounts with the developer, or subscriptions,
  so there are no payment or refund terms.
- **What the documents describe**: the current app. That includes the screensaver handoff, the
  wallpaper helper, the saved original wallpaper (feature 004), local-only logs, and sign-in
  through the system browser.
- **Not legal advice**: these are drafts prepared from how the app works. The owner should have
  them reviewed by a qualified lawyer before relying on them.
- **Product name and publisher**: **Glimpse**, published by an independent developer, as an
  individual (owner's answer, 2026-10-28). It matches the Google consent screen. The documents
  call the publisher "the developer of Glimpse" ("we"). The owner can add their full name before
  publishing. The app's own windows and README still say "Google Photos Wallpaper", and renaming
  them is separate work.
- **Contact**: yossi.eynav@gmail.com, the owner's Google account email, chosen by the owner to
  be public in both documents.
- **Governing law**: the laws of the State of Israel, with the competent courts of Tel Aviv-Yafo
  (owner's answer). Consumer-protection laws in the user's own country still apply where they
  can't be waived.
