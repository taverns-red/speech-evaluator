---
name: macOS-Native Automation Standard
description: Enforces macOS environments for agent execution and browser interactions.
---

# Execution Context
* **Host:** Native macOS (Darwin). Never assume a Linux or headless container environment.
* **Web Interactions:** Exclusively utilize the integrated Google Antigravity browser subagent. Do not attempt to install or configure external headless browsers or Linux GUI bridges.
* **System Automation:** When interacting with the host system—especially for triggering push notifications, Shortcuts, or local scripts—strictly utilize macOS-native binaries (`shortcuts`, `osascript`, `zsh`).

# Verification
* Before executing complex multi-step web tasks, verify browser connectivity by loading a simple local HTML file.
* Maintain a deployable, testable state in small increments rather than executing monolithic scripts that assume environment parity.
