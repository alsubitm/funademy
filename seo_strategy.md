# SEO Strategy — FunAdemy · e² Young Engineers Riyadh

## Site Overview
Arabic-first (RTL) education platform for e² Young Engineers Riyadh franchise, with a full English mirror under `/en`. Targets families in Riyadh, Saudi Arabia looking for STEM programs (LEGO®-based engineering) for children aged 4–18.

## Rendering Mode
**Next.js 15 App Router with ISR/SSR** (`artifacts/ye`) — pages are server-rendered; full HTML is returned to crawlers. Public marketing pages are indexable.

## In Scope (Public pages)
- Homepage: `/` (Arabic) and `/en` (English)
- Programs listing: `/programs`, `/en/programs`
- Program pages: `/programs/[slug]` and `/en/programs/[slug]`
- Blog: `/blog`, `/blog/[slug]`, `/en/blog`, `/en/blog/[slug]`
- Campaign: `/watanona`, `/en/watanona`
- Contact: `/contact`, `/en/contact`
- Book trial: `/book`, `/en/book`
- Enroll: `/enroll`, `/en/enroll`
- Consult: `/consult`, `/en/consult`
- Help: `/help`, `/en/help`
- Privacy/Terms: `/privacy`, `/en/privacy`, `/terms`, `/en/terms`
- `/nelc`, `/en/nelc` are retired (permanent redirects to contact) — intentionally not in the sitemap.

## Out of Scope (Authenticated / Admin / Tools)
- `/admin` — admin dashboard, blocked in robots.txt
- `/portal`, `/account` — family portal (OTP login required)
- `/learn/**` — kids learning platform (authenticated)
- `/instructor` — instructor tools
- `/svc/**` — API routes, blocked in robots.txt
- `/windmill/` (`artifacts/windmill`) — classroom Virtual Engineering Lab tool, intentionally `noindex, nofollow`

## Target Audience
- Arabic-speaking parents in Riyadh, Saudi Arabia searching for after-school STEM programs
- English-speaking expat families in Riyadh
- Schools and institutions researching e² Young Engineers programs

## Primary Keywords
- Arabic: المهندس الصغير, برامج ليغو للأطفال, تعليم STEM الأطفال, حصص ليغو, هندسة أطفال الرياض
- English: LEGO engineering for kids Riyadh, STEM programs children Saudi Arabia, e2 Young Engineers Riyadh

## Crawler assumptions
- AI crawlers allowed (robots.txt allows `*`); `llms.txt` route exists.

## Dismissed Categories
- (None yet)
