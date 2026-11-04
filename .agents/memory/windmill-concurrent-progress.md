---
name: Windmill concurrent progress
description: Why concurrent lesson snapshots require explicit reload rather than merging.
---

Treat another tab's saved change as a conflict requiring reload, not as progress to merge into an older tab.

**Why:** Construction is ordered, and undo, reset, hints, and tested status form one coherent snapshot. Taking the longest build or unioning stages can undo a teacher's intentional reset. Equal JSON does not prove nothing changed: a build followed by a reset can return to the same snapshot.

**How to apply:** Serialize all lesson-progress writers with the same browser lock and check a write revision as well as the snapshot inside an IndexedDB transaction. Any future import or clear-device flow must participate in this policy. If safe synchronization is unavailable, allow explicitly unsaved practice rather than an unsafe persistence fallback. Keep write tokens anonymous and device-local.

Do not treat passing sequential two-tab tests as proof that queued clears are safe.

**Why:** Repeated system-Chromium desktop/touch runs with two actual pending lock requests and suppressed storage/focus notifications intermittently allowed a stale hint save to restore a cleared build. Instrumenting the granted callbacks confirmed the stale writer could read both the old snapshot and old revision after the clear writer had been granted first. Zero-delay timers before reading or before releasing the lock did not eliminate the failure. Browser lock ownership alone is not sufficient evidence that another renderer's localStorage view is current.

**How to apply:** Retain the queued-clear regression as a release gate. Never restore localStorage as the concurrency authority or mask synchronization failures with timer delays.

The user approved moving lesson saves to transactional browser storage, preserving existing progress and the existing backup/clear controls.

**Why:** Web Locks plus localStorage revision checks reproduced stale cross-renderer reads; atomic revision checks and saves are needed to keep confirmed clears safe.

**How to apply:** Keep saves anonymous, device-local, and offline. Migrate legacy saves only when no canonical record exists; after that, never promote an old tab's compatibility mirror over canonical progress.
