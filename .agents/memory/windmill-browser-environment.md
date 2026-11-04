---
name: Windmill browser environment
description: Browser runtime constraints observed in the Nix workspace.
---

Do not assume Playwright's downloaded browsers can run in this Nix workspace.
System Chromium worked when downloaded Chromium lacked glib; Firefox and WebKit
also lacked native libraries. Do not report those engines or physical devices as
verified based on Chromium emulation.

**Why:** Browser download succeeded while engine launch failed, which is an
environment limitation rather than a lesson regression.

**How to apply:** Use the documented explicit system-Chromium override here,
and retain default multi-engine execution on supported hosts. Report unavailable
engines rather than silently removing them from coverage.
