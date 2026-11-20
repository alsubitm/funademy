---
name: Admin paging semantics
description: Ordering and live-count tradeoffs for mutable booking and course-run lists
---

Keep admin booking and course-run traversal ordered by immutable identity, newest added first, rather than mutable activity flags or course dates.

**Why:** A course date or active-state edit can move a record across a cursor based on those fields, causing duplicate or skipped records during a traversal. Offset pages also shift when records are inserted or deleted.

**How to apply:** Any future sort options must explicitly address concurrent edits instead of silently replacing the stable traversal order. Counts describe current matching records, not a frozen multi-request snapshot; records can legitimately enter or leave a filter after edits. Keep this distinction visible to administrators.
