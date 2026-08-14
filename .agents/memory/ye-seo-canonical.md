---
name: YE SEO canonical URL
description: How absolute URLs (canonical/hreflang/OG/JSON-LD/sitemap/robots/llms.txt) must be built in the ye artifact
---

# Canonical URL rule

All absolute URLs in SEO surfaces come from `siteUrl()` in `src/lib/site-url.ts`,
which returns the hardcoded canonical domain `https://funademy.io` (overridable
via the `SITE_URL` env var). No file may read `REPLIT_DOMAINS` for URLs.

**Why:** Incident 2026-08-14 — production served canonical/hreflang/OG/JSON-LD
pointing at `learning-hub-….replit.app` (runtime REPLIT_DOMAINS in deployment)
while robots.txt/sitemap.xml pointed at the `…picard.replit.dev` dev domain
(baked at publish-build time, which runs in the workspace env). Google was told
the real site lives on temporary domains. SEO task agents had also guessed a
wrong fallback domain (`funademy.sa` — site is funademy.io).

**How to apply:**
- Any new page metadata, JSON-LD, OG tag, feed, or txt endpoint: import
  `siteUrl()`; never env-derive the domain, never hardcode it inline.
- DB-backed request-time endpoints (`sitemap.ts`, `llms.txt/route.ts`) must keep
  `export const dynamic = 'force-dynamic'` — otherwise the publish build bakes
  DEV-database content (blog/program slugs) into the deployed file. Their
  prisma calls must keep `.catch()` fallbacks (nested vitest build runs with an
  unreachable DB — see ye-build-resilience-guard).
- llms.txt lives at `src/app/llms.txt/route.ts`, reads programs + published
  blog posts live, English-primary with Arabic names.
