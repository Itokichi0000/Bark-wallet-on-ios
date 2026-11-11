#!/usr/bin/env bash
# Picks the newest Xcode 26+ installed on the runner. App Store Connect
# requires apps built with the iOS 26 SDK or later.
set -euo pipefail
latest=$(ls -d /Applications/Xcode_*.app 2>/dev/null | grep -E 'Xcode_[0-9.]+\.app$' | sort -V | tail -1 || true)
if [ -n "${latest}" ]; then
  sudo xcode-select -s "${latest}/Contents/Developer"
fi
xcodebuild -version
