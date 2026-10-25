#!/usr/bin/env bash
# Boots an iOS 26 simulator, installs the Release build, drives the example
# with Maestro in light and dark mode, records the scripted demo (for the
# README GIFs) in both modes, and leaves screenshots and recordings in
# artifacts/ios. Run from the repository root after the xcodebuild step.
set -uo pipefail

OUT=artifacts/ios
mkdir -p "$OUT"
APP_ID=dev.expohottoast.example
APP=$(find example/ios/build/Build/Products/Release-iphonesimulator -maxdepth 1 -name '*.app' | head -1)
DEVICE=${IOS_DEVICE:-iPhone 17 Pro}
RUNTIME=${IOS_RUNTIME:-iOS-26-5}

UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
device, runtime = sys.argv[1], sys.argv[2]
for key, devices in json.load(sys.stdin)["devices"].items():
    if key.endswith(runtime):
        for d in devices:
            if d["name"] == device:
                print(d["udid"])
                sys.exit()
' "$DEVICE" "$RUNTIME")
if [ -z "$UDID" ] || [ -z "$APP" ]; then
  echo "No $DEVICE simulator on $RUNTIME, or no built app ($APP)"
  xcrun simctl list devices available
  exit 1
fi

xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl ui "$UDID" appearance light
xcrun simctl install "$UDID" "$APP"

status=0
(cd "$OUT" && maestro --device "$UDID" test ../../example/.maestro/smoke.yaml) || status=$?
(cd "$OUT" && maestro --device "$UDID" test ../../example/.maestro/rich.yaml) || status=$?
xcrun simctl ui "$UDID" appearance dark
(cd "$OUT" && maestro --device "$UDID" test ../../example/.maestro/dark.yaml) || status=$?

# The scripted demo, started by a long-press on the title (see playDemo in
# App.tsx). A deep link would not do: iOS asks "Open in ...?" first, and the
# recording showed that dialog instead of the demo. Recording runs around the
# whole flow; the clips are trimmed later.
record_demo() {
  local name=$1
  local flow=${2:-demo}
  xcrun simctl terminate "$UDID" "$APP_ID" || true
  xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$OUT/$name.mp4" &
  local recorder=$!
  sleep 2
  (cd "$OUT" && maestro --device "$UDID" test "../../example/.maestro/$flow.yaml") || true
  sleep 28
  kill -INT "$recorder" || true
  wait "$recorder" || true
}
record_demo demo-dark
# The rich toasts, scripted the same way (playRichDemo), for the website.
record_demo rich-dark demo-rich
xcrun simctl ui "$UDID" appearance light
record_demo demo-light
record_demo rich-light demo-rich

cp -R "$HOME/.maestro/tests" "$OUT/maestro-debug" 2>/dev/null || true
xcrun simctl shutdown "$UDID" || true

exit "$status"
