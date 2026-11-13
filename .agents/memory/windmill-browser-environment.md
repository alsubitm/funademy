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

The runner can identify itself as Ubuntu while relying on Nix-provided tools;
`/etc/os-release` alone is not evidence that Playwright's native prerequisites
are available. A successful system-package configuration callback also does not
prove downloaded browsers can resolve those libraries or their ABI versions.

**Why:** Package configuration succeeded but Firefox still failed to load GTK,
and its NSS requirements differed from the libraries found by the loader.
WebKit also remained missing native dependencies.

**How to apply:** Require actual engine launch and passing test results on the
intended runner before claiming coverage. Do not equate a prepared CI workflow
with an executed check.

Repository connection controls must be used in the main app, not the task's
restricted Git pane. A main-app Git connection can enable authenticated `git`
and `gh` access even while the separately listed GitHub integration remains
unattached.

**Why:** Repeated integration attachment attempts did not grant access; connecting
and pushing from the main app made repository reads and Actions access work.

**How to apply:** Check the actual Git panel state and try a read-only repository
operation after main-app connection. Do not repeatedly ask for OAuth approval
solely because the integration catalog still says `connect`. Never extract or
print the managed credentials.
