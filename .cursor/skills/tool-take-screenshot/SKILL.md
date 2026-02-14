---
name: tool-take-screenshot
description: Use when calling MCP take_screenshot or capturing device/simulator screen without app code.
---

# take_screenshot

## How it works

- Runs **host CLI** only: **Android** → `adb exec-out screencap -p`, **iOS** → `xcrun simctl io booted screenshot <path>` then read file. No native module or eval in the app.
- Returns PNG as MCP image content (or base64/text for compatibility). **platform** is required (`android` | `ios`); iOS is simulator only.
- Optional: **filePath**, **format**, **quality**. Use when you need to verify UI or share a screenshot.
