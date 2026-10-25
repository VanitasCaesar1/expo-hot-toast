#!/usr/bin/env bash
# Installs the release APK on the running emulator, drives the example with
# Maestro in light and dark mode, records the scripted demo (for the README
# GIFs) in both modes, and leaves screenshots, recordings and logcat in
# artifacts/android. Run from the repository root.
set -uo pipefail

APK=example/android/app/build/outputs/apk/release/app-release.apk
OUT=artifacts/android
mkdir -p "$OUT"

# A cold, GPU-less emulator often shows "Pixel Launcher isn't responding" over
# the app. Hide system error dialogs and give the launcher time to settle.
adb shell settings put global hide_error_dialogs 1 || true
adb shell settings put secure anr_show_background 0 || true
sleep 20
adb shell input keyevent KEYCODE_HOME || true

adb install -r "$APK"
adb shell cmd uimode night no

adb shell screenrecord --time-limit 170 /sdcard/smoke.mp4 &

status=0
(cd "$OUT" && maestro test ../../example/.maestro/smoke.yaml) || status=$?
(cd "$OUT" && maestro test ../../example/.maestro/rich.yaml) || status=$?

adb shell cmd uimode night yes
(cd "$OUT" && maestro test ../../example/.maestro/dark.yaml) || status=$?

# Stop the recorder on the device so it finalises the file.
adb shell pkill -INT screenrecord || true
sleep 3
adb pull /sdcard/smoke.mp4 "$OUT/smoke.mp4" || true

# The scripted demo, started by a long-press on the title (see playDemo in
# App.tsx). Recording runs around the whole flow; the clips are trimmed later.
APP_ID=dev.expohottoast.example
# The emulator sometimes drops offline for a moment after a long Maestro run,
# and the next launch then fails with "device offline". Wait for it to come
# back, and give the demo flow one retry.
wait_for_emulator() {
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
}
record_demo() {
  local name=$1
  wait_for_emulator
  adb shell am force-stop "$APP_ID"
  adb shell screenrecord "/sdcard/$name.mp4" &
  sleep 1
  (cd "$OUT" && maestro test ../../example/.maestro/demo.yaml) || {
    wait_for_emulator
    (cd "$OUT" && maestro test ../../example/.maestro/demo.yaml) || true
  }
  sleep 26
  adb shell pkill -INT screenrecord || true
  sleep 3
  adb pull "/sdcard/$name.mp4" "$OUT/$name.mp4" || true
}
record_demo demo-dark
adb shell cmd uimode night no
record_demo demo-light

adb logcat -d > "$OUT/logcat.txt" || true
# Maestro keeps its own logs, and a screenshot at the failing step.
cp -R "$HOME/.maestro/tests" "$OUT/maestro-debug" 2>/dev/null || true

exit "$status"
