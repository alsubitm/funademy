---
name: Windmill concurrent progress
description: Why concurrent lesson snapshots require explicit reload rather than merging.
---

Treat another tab's saved change as a conflict requiring reload, not as progress to merge into an older tab.

**Why:** Construction is ordered, and undo, reset, hints, and tested status form one coherent snapshot. Taking the longest build or unioning stages can undo a teacher's intentional reset. Equal JSON does not prove nothing changed: a build followed by a reset can return to the same snapshot.

**How to apply:** Serialize all lesson-progress writers with the same browser lock and check a write revision as well as the snapshot. Any future import or clear-device flow must participate in this policy. If safe synchronization is unavailable, allow explicitly unsaved practice rather than an unsafe persistence fallback. Keep write tokens anonymous and device-local.
