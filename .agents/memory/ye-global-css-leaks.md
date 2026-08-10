---
name: YE global CSS element selectors leak
description: globals.css in the ye artifact styles bare element selectors (nav, footer, section, details/summary) that leak into every page including /admin
---
The ye artifact's `globals.css` contains bare element-selector rules, notably `nav { position: sticky; top: 0; z-index: 60; background: rgba(255,255,255,.85); backdrop-filter: blur(...); box-shadow; transition }`, plus `footer`, `section { padding: 100px 0 }`, and `details`/`summary` (FAQ styling with a "+" marker). These apply to ANY such element anywhere in the app, including the admin panel.

**Why:** Two incidents in /admin: (1) the fixed mobile bottom nav inherited `top: 0` — combined with its own `bottom: 0` it stretched over the whole viewport and intercepted all taps; (2) the desktop sidebar's `<nav>` inherited the translucent white background + backdrop blur + box-shadow over its dark gradient (and blocked adding internal overflow scroll cleanly).

**How to apply:** When adding any `<nav>`/`<footer>`/`<details>` (or other bare-element-styled tag) outside the public site layout, explicitly reset ALL leaked properties: `top: auto`, `background`, `backdrop-filter` (+ `-webkit-`), `box-shadow`, `transition`. `admin/page.css` has scoped reset blocks to copy (`.admin-sidebar nav`, `.mobile-bottom-nav`). Better long-term: scope the global rules to the public header/footer (proposed as a follow-up task).

Related scroll gotchas fixed alongside (same admin panel): a horizontally scrollable flex toolbar needs `justify-content: flex-start` (with `space-around`/`center`, overflowing items clip on both edges unreachably) and `flex: 0 0 auto` children (otherwise they squish to fit instead of triggering `overflow-x: auto`).
