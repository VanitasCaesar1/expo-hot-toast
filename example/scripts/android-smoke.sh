#!/usr/bin/env bash
# Installs the release APK on the running emulator, drives the example with
# Maestro in light and dark mode, and leaves screenshots, a screen recording
# and logcat in artifacts/android. Run from the repository root.
set -uo pipefail

APK=example/android/app/build/outputs/apk/release/app-release.apk
OUT=artifacts/android
mkdir -p "$OUT"

adb install -r "$APK"
adb shell cmd uimode night no

adb shell screenrecord --time-limit 170 /sdcard/smoke.mp4 &

status=0
(cd "$OUT" && maestro test ../../example/.maestro/smoke.yaml) || status=$?

adb shell cmd uimode night yes
(cd "$OUT" && maestro test ../../example/.maestro/dark.yaml) || status=$?

# Stop the recorder on the device so it finalises the file.
adb shell pkill -INT screenrecord || true
sleep 3
adb pull /sdcard/smoke.mp4 "$OUT/smoke.mp4" || true
adb logcat -d > "$OUT/logcat.txt" || true

exit "$status"
