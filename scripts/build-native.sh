#!/usr/bin/env bash
# Builds the native piece with swiftc from the Command Line Tools (no Xcode):
#   build/glimpse-helper             wallpaper helper (contracts/wallpaper-helper.md)
# It is universal (arm64 + x86_64). Signs ad-hoc, or with $DEVELOPER_ID
# (e.g. "Developer ID Application: Name (TEAMID)") when set.
set -euo pipefail

cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p build

sign() {
  if [[ -n "${DEVELOPER_ID:-}" ]]; then
    codesign --force --options runtime --timestamp --sign "$DEVELOPER_ID" "$1"
  else
    codesign --force --sign - "$1"
  fi
  codesign --verify "$1"
}

# Compiles one Swift target for both architectures and merges them: universal <out> <swiftc args…>
universal() {
  local out="$1"
  shift
  for arch in arm64 x86_64; do
    swiftc -O -target "$arch-apple-macos14.0" "$@" -o "$TMP/$(basename "$out")-$arch"
  done
  lipo -create "$TMP/$(basename "$out")-arm64" "$TMP/$(basename "$out")-x86_64" -output "$out"
}

build_helper() {
  universal build/glimpse-helper -parse-as-library -framework AppKit native/helper/main.swift
  sign build/glimpse-helper
  echo "Built build/glimpse-helper"
}

build_helper
