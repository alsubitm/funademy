---
name: YE global CSS element selectors leak
description: globals.css in the ye artifact styles bare element selectors (nav, footer, etc.) that leak into every page including /admin
---
The ye artifact's `globals.css` contains bare element-selector rules, notably `nav { position: sticky; top: 0; z-index: 60; ... }` and `footer::before`. These apply to ANY `<nav>`/`<footer>` anywhere in the app, including the admin panel.

**Why:** A fixed bottom nav in /admin inherited `top: 0` from the global `nav` rule; combined with its own `bottom: 0`, it stretched over the whole viewport, hid the content, and intercepted all taps on mobile.

**How to apply:** When adding any `<nav>`/`<footer>` (or other bare-element-styled tag) outside the public site layout, explicitly reset the leaked properties (`top: auto`, backdrop-filter, background) or use a different element. Better long-term: scope the global rules to the public header.
