#!/usr/bin/env bash
# Boots an iPhone simulator, runs the Debug build against the real signet
# Ark server and screenshots every screen (uses the DEBUG-only autopilot).
set -euo pipefail

APP="build/DerivedData/Build/Products/Debug-iphonesimulator/SatsOS.app"
BUNDLE_ID="com.itokichi0000.satsos"
OUT="build/screenshots"
mkdir -p "${OUT}"

UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
phones = [d for runtime, ds in devices.items() if "iOS" in runtime for d in ds if d["name"].startswith("iPhone")]
pro = [d for d in phones if "Pro" in d["name"] and "Max" not in d["name"]]
print((pro or phones)[-1]["udid"])
')
echo "Simulator: ${UDID}"
xcrun simctl boot "${UDID}" || true
xcrun simctl bootstatus "${UDID}" -b
xcrun simctl status_bar "${UDID}" override --time "9:41" --batteryState charged --batteryLevel 100 || true
xcrun simctl install "${UDID}" "${APP}"

run() {
  local name=$1 mode=$2 wait=$3
  echo "==> ${name} (${mode}, ${wait}s)"
  xcrun simctl terminate "${UDID}" "${BUNDLE_ID}" 2>/dev/null || true
  xcrun simctl launch "${UDID}" "${BUNDLE_ID}" -SatsOSAutopilot "${mode}" >/dev/null
  sleep "${wait}"
  xcrun simctl io "${UDID}" screenshot "${OUT}/${name}.png" >/dev/null
}

run 01-setup setup 20
run 02-splash boot 40
run 03-home home 30
run 04-receive receive 25
run 05-send send 15
run 06-history history 15
run 07-learn learn 15
run 08-settings settings 20
run 09-receive-incoming receive-incoming 30
run 10-aquarium aquarium 25
run 11-guide guide 20

# more scenes of the しくみ film
for scene in 0 2 4 5 6 7 8 9; do
  run "16-story-${scene}" "learn-${scene}" 12
done

# the same screens in dark mode
xcrun simctl ui "${UDID}" appearance dark
run 12-home-dark home 25
run 13-learn-dark learn 15
run 14-aquarium-dark aquarium 20
run 15-send-dark send 15
xcrun simctl ui "${UDID}" appearance light

# keep the app's own log lines (wallet open errors etc.) for debugging
xcrun simctl spawn "${UDID}" log show --last 10m --style compact \
  --predicate 'process == "SatsOS"' > "${OUT}/app.log" 2>/dev/null || true
ls -la "${OUT}"
