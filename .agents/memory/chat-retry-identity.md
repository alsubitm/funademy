---
name: Chat retry identity
description: Why chat delivery retries must recover the original saved turn rather than regenerate an answer.
---

A retry after interrupted delivery is the same conversation turn, not a new
question. Recover the original answer with its original sources and prepared
actions rather than generating a replacement.

**Why:** The server can commit an answer before the browser receives its
completion event. Hiding duplicate bubbles locally still leaves duplicate
prompts in saved history and can prepare the same action twice.

**How to apply:** Preserve the logical send identity through delivery failures.
Recovery checks must reopen the persisted transcript and verify action identity,
not only count the bubbles currently rendered in the widget. Avoid holding a
lock only in process memory: retries can reach another application instance.
