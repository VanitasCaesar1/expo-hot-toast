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

adb shell cmd uimode night yes
(cd "$OUT" && maestro test ../../example/.maestro/dark.yaml) || status=$?

# Stop the recorder on the device so it finalises the file.
adb shell pkill -INT screenrecord || true
sleep 3
adb pull /sdcard/smoke.mp4 "$OUT/smoke.mp4" || true

# The scripted demo, opened by deep link once the app is up so the recording
# starts on a settled screen. Each run uses a new URL so it plays again.
APP_ID=dev.expohottoast.example
record_demo() {
  local name=$1 run=$2
  adb shell am force-stop "$APP_ID"
  adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 > /dev/null
  sleep 15
  adb shell screenrecord --time-limit 27 "/sdcard/$name.mp4" &
  sleep 1
  adb shell am start -a android.intent.action.VIEW -d "expohottoast://demo?run=$run" "$APP_ID" > /dev/null
  sleep 28
  adb pull "/sdcard/$name.mp4" "$OUT/$name.mp4" || true
}
record_demo demo-dark 1
adb shell cmd uimode night no
record_demo demo-light 2

adb logcat -d > "$OUT/logcat.txt" || true
# Maestro keeps its own logs, and a screenshot at the failing step.
cp -R "$HOME/.maestro/tests" "$OUT/maestro-debug" 2>/dev/null || true

exit "$status"
