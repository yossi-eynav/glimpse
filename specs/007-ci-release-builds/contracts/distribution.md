# Contract: Distribution

These are the things users, the README and the owner rely on. Changing any of them is a
breaking change.

## D1. Download links (users, README)

| What | URL |
|------|-----|
| Releases page | `https://github.com/yossi-eynav/glimpse/releases/latest` |
| Disk image | `https://github.com/yossi-eynav/glimpse/releases/latest/download/Glimpse-universal.dmg` |
| Zip | `https://github.com/yossi-eynav/glimpse/releases/latest/download/Glimpse-universal.zip` |

Both files contain `Glimpse.app`, which is:
- universal (`arm64` and `x86_64`)
- ad-hoc signed
- valid under `codesign --verify --deep --strict`
- bundle ID `com.yossieynav.glimpse`

## D2. Triggers (owner)

| Action | Result |
|--------|--------|
| Push to any branch | test, then package. The run artifact is `Glimpse-<version>-<sha7>` |
| Push to `main` | the above, then the `latest` release is replaced |
| Pull request (this repository) | test, then package |
| Pull request (fork) | test only |
| Push a tag | nothing |

## D3. Secrets (owner)

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | the OAuth Desktop client ID (the `clientId` in `config/google.json`) |
| `GOOGLE_CLIENT_SECRET` | its client secret (`clientSecret`) |

Set them in GitHub under Settings → Secrets and variables → Actions → Repository secrets.

## D4. Release notes template

```markdown
Glimpse <version>, built from <sha7> (https://github.com/yossi-eynav/glimpse/commit/<sha>) on <YYYY-MM-DDTHH:MM:SSZ>.

**Install**
1. Download **Glimpse-universal.dmg**, open it, and drag Glimpse to Applications.
2. Open Glimpse. macOS says it can't check it for malware, because Glimpse isn't notarized by Apple. Click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to Glimpse. Confirm with your password.
4. Glimpse appears in the menu bar. You only need to do this once.

After an update, macOS may ask to let Glimpse use its saved sign-in in your Keychain. Choose **Always Allow**.
```

## D5. Local scripts

- `scripts/adhoc-sign.sh <path/to/Glimpse.app>` ad-hoc signs the bundle and verifies it. It
  exits non-zero on failure.
- `scripts/check-package.sh <path/to/Glimpse.app>` checks:
  - the signature: `codesign --verify --deep --strict`
  - that it is ad-hoc: `Signature=adhoc` in `codesign -dv`
  - the architectures: `lipo -archs` on `Contents/MacOS/Glimpse`, which includes both `arm64`
    and `x86_64`
  - the bundled files: `Contents/Resources/` contains `glimpse-helper`, `Glimpse.saver` and
    `google.json`

  It prints one line per check and exits non-zero if any fails.
