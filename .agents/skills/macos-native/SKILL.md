---
name: macOS-Native Automation Standard
description: Enforces macOS environments for agent execution and browser interactions.
---

# Execution Context
* **Host:** Native macOS (Darwin). Never assume a Linux or headless container environment.
* **Web Interactions:** Exclusively utilize the integrated Google Antigravity browser subagent. Do not attempt to install or configure external headless browsers or Linux GUI bridges.
* **System Automation:** When interacting with the host system—especially for triggering push notifications, Shortcuts, or local scripts—strictly utilize macOS-native binaries (`shortcuts`, `osascript`, `zsh`).

# Browser Tool Workarounds

The `open_browser_url` tool has a hard-coded Linux guard ("local chrome mode is only supported on Linux"). On macOS, use these alternatives:

## 1. HTTP Bypass (for DOM verification — preferred)
Use `curl` to fetch HTML and parse it directly. No visual browser needed for checking text, structure, or API responses:
```bash
# Check footer text
curl -s http://localhost:3004/ | grep -o '<footer[^>]*>.*</footer>'

# Check API endpoint
curl -s http://localhost:3004/api/version | python3 -m json.tool
```

For complex JS-rendered pages, write a quick Node.js or Python script to parse the DOM.

## 2. Native macOS Chrome (for visual verification)
To open a page on the user's screen:
```bash
open -a "Google Chrome" "http://localhost:3004"
```

## 3. Never use the browser subagent on macOS
The `open_browser_url` tool will always fail on Darwin. Do not retry it. Use the alternatives above.

# Verification
* Before executing complex multi-step web tasks, verify browser connectivity by loading a simple local HTML file.
* Maintain a deployable, testable state in small increments rather than executing monolithic scripts that assume environment parity.
