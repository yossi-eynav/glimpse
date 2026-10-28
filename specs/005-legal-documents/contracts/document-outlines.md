# Contract: Document Outlines

The required section order for each file. The wording comes from
[data-model.md](../data-model.md), and the facts from [research.md R1](../research.md).

## PRIVACY.md: "Glimpse Privacy Policy"

1. **Header**: product, publisher, contact, Last updated.
2. **Summary**: one paragraph. "Glimpse shows photos you pick from Google Photos as your Mac's
   wallpaper and screensaver. Everything stays on your Mac. We never see your photos, and
   nothing is sent to us."
3. **What Glimpse accesses**: the picked photos (read-only), the email, and the sign-in tokens.
   Glimpse can't see the rest of the library, and never uploads, changes, or deletes anything in
   it (FR-005 and FR-006).
4. **How Glimpse uses it**: the wallpaper, the screensaver, showing the account email in the
   menu, and offline rotation. Nothing else.
5. **Where it's stored**: on your Mac only. A short list from R1, including the encrypted tokens
   (Keychain key) and the original wallpaper (FR-007).
6. **Who it's shared with**: Google only, to sign in and fetch the photos you picked. No
   analytics, ads, tracking or sale (L3, FR-008).
7. **Google API Services User Data Policy**: L1, word for word (FR-010).
8. **Keeping and deleting your data**: removing a photo; Sign out (everything, plus a revoke);
   uninstalling, with the folder paths; revoking at Google (L4) (FR-009).
9. **Security**: the encryption and Keychain key, and data never leaving the Mac except to Google.
   Plain language, with no guarantees.
10. **Children**: not directed to children under 13. Google's age rules apply.
11. **Your rights**: access, deletion and objection. Because the data is only on your Mac, you
    exercise these rights yourself (see section 8). You can still contact us with questions.
    This covers the GDPR, UK and California wording in one paragraph.
12. **Changes to this policy**: the "Last updated" rule; material changes announced in the app's
    release notes and on the website.
13. **Contact**.
14. **Not affiliated with Google**: L2.

## TERMS.md: "Glimpse Terms of Service"

1. **Header**: product, publisher, contact, Last updated.
2. **Agreement**: by downloading or using Glimpse, you agree to these terms. If you don't agree,
   don't use it.
3. **What Glimpse is**: one paragraph matching the app, free of charge.
4. **Who can use it**: you need a Mac, and a Google account in good standing. You must follow
   Google's terms, and be old enough to use Google services where you live.
5. **Your responsibilities**: you have the right to display the photos you pick, and you use
   Glimpse lawfully.
6. **Google services and macOS**: Glimpse depends on Google's services and on macOS, which can
   change or stop working. We aren't responsible for them.
7. **License**: a personal, non-exclusive, non-transferable, revocable license to use the app.
   You may not resell it, or misuse it to get around Google's limits.
8. **Privacy**: a link to `PRIVACY.md`.
9. **No warranty**: L5 (as is).
10. **Limitation of liability**: L5, to the maximum extent permitted by law.
11. **Stopping**: stop at any time by signing out and uninstalling. We may stop offering Glimpse.
12. **Changes to these terms**: the "Last updated" rule.
13. **Governing law**: Israel, the courts of Tel Aviv-Yafo, and mandatory consumer law preserved.
14. **Contact**.
15. **Not affiliated with Google**: L2.
