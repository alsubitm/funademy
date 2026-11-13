---
name: Invitation retry boundary
description: Why invitation retry recovery uses a tab-scoped operation identity rather than guardian identity.
---

Refresh recovery is for an unresolved invitation attempt in the same tab, not a permanent uniqueness rule for students or families.

**Why:** siblings share guardian email, and even names need not uniquely identify children. Global identity-based deduplication would silently suppress legitimate seats. Tab-scoped retry state avoids retaining student details across browser sessions; hashed signatures are not encryption and must not be treated as a privacy guarantee.

**How to apply:** preserve pending operation identity before sending, fail closed if it cannot be persisted, and clear it only after a confirmed success. Cross-tab/device duplicate prevention requires a separate product decision, not a unique constraint on student name or guardian email.
