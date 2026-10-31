#!/usr/bin/env bash
# Checks a packaged Glimpse.app (contracts/distribution.md D5): valid ad-hoc signature,
# universal binary, bundled native pieces and config. Exits 1 if any check fails.
set -uo pipefail

app="${1:?usage: check-package.sh <path/to/Glimpse.app>}"
failed=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "ok   $label"
  else
    echo "FAIL $label"
    failed=1
  fi
}

check "signature is valid (codesign --verify --deep --strict)" codesign --verify --deep --strict "$app"
if ! codesign --verify --deep --strict "$app" 2>/dev/null; then
  codesign --verify --deep --strict "$app" 2>&1 | sed 's/^/     /'
fi
check "signature is ad-hoc" bash -c 'codesign -dv "$1" 2>&1 | grep -q "^Signature=adhoc$"' _ "$app"
check "universal (arm64 + x86_64)" bash -c 'a=$(lipo -archs "$1/Contents/MacOS/Glimpse") && [[ $a == *arm64* && $a == *x86_64* ]]' _ "$app"
for f in glimpse-helper Glimpse.saver google.json; do
  check "bundles Resources/$f" test -e "$app/Contents/Resources/$f"
done

exit "$failed"
