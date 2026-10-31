#!/usr/bin/env bash
# Ad-hoc signs a packaged app bundle when no Developer ID is available, so a downloaded copy
# gets Gatekeeper's "Open Anyway" instead of "damaged" (specs/007-ci-release-builds R1).
set -euo pipefail

app="${1:?usage: adhoc-sign.sh <path/to/App.app>}"
codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"
echo "Ad-hoc signed $app"
