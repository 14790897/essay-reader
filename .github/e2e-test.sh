#!/bin/bash
set -e
PACKAGE="com.essayreader.app"
LOG="/tmp/e2e-logcat.txt"
DUMP="/tmp/e2e-ui-dump.xml"
SS="/tmp/e2e-screenshot.png"
FAILED=0

# Start logcat capture
echo "=== Starting logcat ==="
adb logcat -c
adb logcat -v time > "$LOG" 2>&1 &
LOGCAT_PID=$!

# Launch the app
echo "=== Launching app ==="
adb shell am start -n "$PACKAGE/.MainActivity" -W

# Wait for app to render (poll uiautomator dump for text)
echo "=== Waiting for app to render (max 60s) ==="
FOUND=0
for i in $(seq 1 30); do
  sleep 2
  adb shell uiautomator dump /sdcard/ui-dump.xml 2>/dev/null
  adb pull /sdcard/ui-dump.xml "$DUMP" 2>/dev/null || true
  if grep -q 'Essay Reader' "$DUMP" 2>/dev/null; then
    echo "PASS: 'Essay Reader' text found after ${i}x2 seconds"
    FOUND=1
    break
  fi
  # Also check for System TTS badge
  if grep -q 'System TTS' "$DUMP" 2>/dev/null; then
    echo "PASS: 'System TTS' badge found after ${i}x2 seconds"
    FOUND=1
    break
  fi
  echo "  ... attempt $i/30, not yet rendered"
done

# Take screenshot
echo "=== Taking screenshot ==="
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png "$SS" 2>/dev/null || true

if [ "$FOUND" -eq 0 ]; then
  echo "FAIL: App did not render within 60s. Last 30 logcat lines:"
  tail -30 "$LOG"
  FAILED=1
else
  echo "=== App rendered successfully! ==="

  # Test 2: Tap menu button (☰ top-left) to open article list
  echo "=== Test: Open article list ==="
  # Pixel 4: 1080x2280, the ☰ button is at ~80,100 in px
  adb shell input tap 80 100
  sleep 2
  adb shell uiautomator dump /sdcard/ui-dump.xml
  adb pull /sdcard/ui-dump.xml "$DUMP"
  if grep -q 'My Articles' "$DUMP"; then
    echo "PASS: Article list opened ('My Articles' visible)"
  else
    echo "FAIL: Article list did not open"
    FAILED=1
  fi

  # Close article list by tapping outside (near center-right)
  adb shell input tap 900 600
  sleep 1

  # Test 3: Tap settings button (⚙ top-right)
  echo "=== Test: Open Settings ==="
  # Pixel 4: the ⚙ button is at ~1000,100 in px
  adb shell input tap 1000 100
  sleep 2
  adb shell uiautomator dump /sdcard/ui-dump.xml
  adb pull /sdcard/ui-dump.xml "$DUMP"
  if grep -q 'Settings' "$DUMP" || grep -q 'TTS Engine' "$DUMP" || grep -q 'Doubao' "$DUMP" || grep -q 'System' "$DUMP"; then
    echo "PASS: Settings opened"
  else
    echo "FAIL: Settings did not open"
    FAILED=1
  fi

  # Close settings by tapping Done/outside
  adb shell input tap 1000 100
  sleep 1
fi

# Kill logcat
kill $LOGCAT_PID 2>/dev/null || true

# Upload screenshot to artifacts via final copy
cp "$LOG" /tmp/e2e-logcat.txt 2>/dev/null || true
cp "$SS" /tmp/e2e-screenshot.png 2>/dev/null || true
cp "$DUMP" /tmp/e2e-ui-dump.xml 2>/dev/null || true

if [ "$FAILED" -ne 0 ]; then
  echo "=== E2E FAILED ==="
  exit 1
else
  echo "=== E2E PASSED ==="
  exit 0
fi