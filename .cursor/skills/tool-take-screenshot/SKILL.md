---
name: tool-take-screenshot
description: Use when calling MCP take_screenshot or capturing device/simulator screen without app code.
---

# take_screenshot

## How it works

- Runs **host CLI** only: **Android** → `adb exec-out screencap -p`, **iOS** → `xcrun simctl io booted screenshot <path>` then read file. No native module or eval in the app.
- **Default for AI vision:** JPEG 80% + 720p (max height). Full PNG often causes timeout; this sweet spot keeps quality while reducing payload.
- **platform** is required (`android` | `ios`); iOS is simulator only.
- Optional: **filePath**, **format** (default `jpeg`), **quality** (default 80), **maxHeight** (default 720; use 0 for original size). Use when you need to verify UI or share a screenshot.
