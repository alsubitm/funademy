---
name: Next.js manual history updates
description: Why manual pushState/replaceState in YE must not reuse window.history.state
---
Manual `history.pushState/replaceState` in the YE app must pass a fresh object (e.g. `{}`), never `window.history.state`.

**Why:** Next 15 patches the history API and skips its router URL sync when the passed state already carries its `__NA` marker. The router then keeps the old URL and a later router commit rewrites the address bar, silently dropping URL-backed filters (admin bookings/runs filters were reset this way; caught only by the Playwright panels test, intermittently).

**How to apply:** any URL-as-state helper (admin query params, tabs) that writes history directly.
