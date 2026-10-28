# Quickstart & Validation: Terms of Service and Privacy Policy

## Automated checks

```sh
npm test                          # includes the R2 fix tests (sign-out and disable delete the screensaver copy)
wc -w PRIVACY.md TERMS.md         # each under 1,500 words (SC-004)
grep -c "including the Limited Use requirements" PRIVACY.md   # exactly 1 (SC-003)
grep -n "Last updated: 2026-10-28" PRIVACY.md TERMS.md       # both present
grep -n "yossi.eynav@gmail.com" PRIVACY.md TERMS.md          # both present
```

**Readability** (SC-004): run the following in Node. It prints a Flesch Reading Ease score for
each file, using a vowel-group heuristic for syllables. Scores of 50 or more pass.

```sh
node -e 'for (const f of ["PRIVACY.md","TERMS.md"]) { const t=require("fs").readFileSync(f,"utf8").replace(/[#*`>|\[\]()_-]/g," "); const w=t.match(/[A-Za-z]+/g)||[]; const s=Math.max(1,(t.match(/[.!?](\s|$)/g)||[]).length); const y=w.reduce((n,x)=>n+Math.max(1,(x.toLowerCase().replace(/e$/,"").match(/[aeiouy]+/g)||[]).length),0); console.log(f, (206.835-1.015*w.length/s-84.6*y/w.length).toFixed(0)); }'
```

## Manual validation

| # | Check | Expected |
|---|-------|----------|
| 1 | **SC-001**: give `PRIVACY.md` to someone new to the app and ask the 5 questions in spec US1 | All 5 are answered correctly, in under 5 minutes |
| 2 | **SC-002**: compare every factual sentence in both files with research.md R1 | 0 mismatches |
| 3 | Sign in, pick photos, turn on the screensaver, then Sign out. Check `~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper/` | There is no `current.jpg` (the R2 fix) |
| 4 | Render both files on GitHub, or with any Markdown preview | Headings, links and lists render correctly |
| 5 | Before publishing: have a lawyer review both files, and host them on your verified domain | Owner's step |

## Recorded results

- **2026-10-28, T010** (fact check against research R1): 3 fixes made to `PRIVACY.md`:
  1. Sign out now also lists "your email address" (the code clears it).
  2. The uninstall step now names `~/Library/Screen Savers/PhotoWallpaperSaver.saver` (the
     screensaver bundle row).
  3. "Signing in and picking photos happen on Google's own pages, in your web browser" was added.

  After these, every R1 row is covered and nothing is claimed beyond R1. 0 mismatches.
- **2026-10-28, T011 and T013**:

  | File | Words | Flesch (quickstart formula) | Limited Use sentence | Last updated | Contact | Other |
  |------|-------|-----------------------------|----------------------|--------------|---------|-------|
  | PRIVACY.md | 802 | 64 | 1 | ✓ | ✓ | not-affiliated ✓ |
  | TERMS.md | 507 | 68 | — | ✓ | ✓ | links to PRIVACY.md ✓, Israel ✓, not-affiliated ✓ |

- **T009** (Limited Use wording, verified online): **not done**.
  `developers.google.com/terms/api-services-user-data-policy` lists the Limited Use rules but no
  sample sentence. Google's help page with the standard sentence (support.google.com) couldn't be
  reached from the build machine. The owner should confirm the sentence before publishing.
- **Path caveat**: `PRIVACY.md` names `~/Library/Application Support/Glimpse/`. Until the app is
  renamed, the real folder is `~/Library/Application Support/Google Photos Wallpaper/`.
