---
name: YE global CSS element selectors leak (RESOLVED)
description: globals.css bare element selectors (nav, footer, section, details/summary) used to leak into internal screens; now scoped to classes
---
RESOLVED. Policy: in ye global CSS only brand typography may target bare elements; everything else must be class-scoped so public-site styling can't bleed into internal screens.

**Why:** Two past incidents in /admin: fixed mobile bottom nav inherited `top:0` and covered the screen; sidebar `<nav>` inherited translucent white bg + blur over its dark gradient.

**How to apply:** When adding a new public-site section, include the `sec` class to get the standard 100px padding + position:relative. New `<nav>`/`<footer>`/`<details>` anywhere need no resets now. Keep bare-element rules out of globals.css (typography like `h1-h4` font-family and `h2` sizing is intentionally still global/brand-wide).

Related scroll gotchas (admin panel): a horizontally scrollable flex toolbar needs `justify-content: flex-start` (with `space-around`/`center`, overflowing items clip on both edges unreachably) and `flex: 0 0 auto` children (otherwise they squish instead of triggering `overflow-x: auto`).
