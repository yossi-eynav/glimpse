#!/usr/bin/env bash
# Builds the native pieces with swiftc from the Command Line Tools (no Xcode):
#   build/pw-helper                  wallpaper helper (contracts/wallpaper-helper.md)
#   build/PhotoWallpaperSaver.saver  screensaver (contracts/screensaver-handoff.md)
# Both are universal (arm64 + x86_64). Signs ad-hoc, or with $DEVELOPER_ID
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
  universal build/pw-helper -parse-as-library -framework AppKit native/helper/main.swift
  sign build/pw-helper
  echo "Built build/pw-helper"
}

build_saver() {
  local name=PhotoWallpaperSaver
  local out="build/$name.saver"
  rm -rf "$out"
  mkdir -p "$out/Contents/MacOS"
  cp native/saver/Info.plist "$out/Contents/Info.plist"
  universal "$out/Contents/MacOS/$name" -parse-as-library -module-name "$name" \
    -Xlinker -bundle -framework ScreenSaver -framework AppKit -framework QuartzCore \
    native/saver/PhotoWallpaperSaverView.swift
  sign "$out"
  echo "Built $out"
}

build_helper
build_saver
