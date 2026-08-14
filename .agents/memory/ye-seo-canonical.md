---
name: YE SEO canonical URL
description: Why all absolute URLs (SEO tags, sitemap, OG images) must come from the canonical-domain helper, never env-derived hosts or raw persisted URLs
---

# Canonical domain

**Rule:** Every absolute URL emitted in SEO surfaces (canonical, hreflang, OG/Twitter, JSON-LD, sitemap, robots, llms.txt) comes from the single canonical-URL helper, which returns the hardcoded public domain (SITE_URL env is the only override).

**Why:** REPLIT_DOMAINS is wrong in every environment that matters: workspace AND publish builds hold the temporary dev domain, deployed runtime holds the .replit.app domain. Both leaked into production SEO tags before centralization. Some files also had a stale wrong-TLD fallback domain.

**How to apply:** Never derive public URLs from env hosts or request headers. New pages import the helper. Sitemap/llms.txt routes stay `force-dynamic` so publish builds can't bake dev-DB data; DB reads there need fallbacks (nested vitest build runs with unreachable DB).

# Persisted URLs are untrusted

**Rule:** Any DB-stored URL (e.g. blog/program cover images) must be sanitized before entering metadata — keep real https hosts, resolve relative paths against the canonical domain, fall back to the default OG image for replit/localhost/http/malformed values.

**Why:** Stored fields are unrestricted; a row saved from a dev session would leak a dev host into production HTML, bypassing the helper. Architect review caught this after the helper was already "done".

**How to apply:** Route stored URLs through the sanitizer next to the canonical helper. A guard test asserts the metadata pages use it and layouts declare `metadataBase`. Extend the sanitizer's blocked-host list rather than adding ad-hoc checks.
