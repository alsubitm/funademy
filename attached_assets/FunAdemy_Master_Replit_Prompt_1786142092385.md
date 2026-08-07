# 🟦 FunAdemy — MASTER SPECIFICATION (single source of truth)

**How to apply:** This is the complete specification for the FunAdemy website. Audit the entire existing codebase against this document and fix EVERY difference — design, content, structure, and copy. Where the current site differs from this spec, **this spec wins**. Work section by section and confirm each with a checklist at the end.

-----

## 1. BRAND & HARD RULES (violations = bugs)

1. Master brand is **FunAdemy** — always written exactly “FunAdemy” in Latin script, even inside Arabic sentences. Never فناديمي, never “Funademy” lowercase-d in headings (nav/logo lockup may style as Fun**Ademy** two-tone).
1. Tagline: **WHERE FUN MEETS ACADEMY** (EN) · «حيث تلتقي المتعة بالأكاديمية» (AR).
1. Young Engineers appears ONLY as a small credit, never as the hero brand. Fixed footer credit on every page:
   `FunAdemy · e² Young Engineers · Falcon Eye Ltd — License 4030388340`
1. **NEVER** display neighborhood names, “licensed territory”, “north”, or any sub-city geography. City = الرياض / Riyadh only. This includes the booking form (no neighborhood dropdown — ask “أونلاين أم حضوري؟” instead).
1. **NEVER** use multicolor/rainbow stripe bands. The only stripe is the **Sand Stripe**: `#F7E3B2 → #F2CD7E → #E5AE4A` (thin gradient divider, may end in gold `#FFCA17` accents — never green-red-blue mixes).
1. The official e² YE logo is loaded from `/public/brand/ye-logo.svg` + `ye-logo-white.svg`. If files are missing, render a small dashed placeholder `[ e² YE ]` — NEVER generate or redraw their logo.
1. Ages sitewide: **4–18**.
1. Arabic is the default language and design direction: `/` = AR with true RTL (all icons, arrows, carousels, progress bars mirrored), `/en` = EN LTR. Language switcher in nav.

-----

## 2. DESIGN SYSTEM (August 2026 — current identity)

### Colors (CSS variables, exact)

```css
--blue:      #1C54CB;  /* primary blue */
--blue-deep: #11388E;
--bp:        #091D52;  /* blueprint night background */
--bp-deep:   #051036;  /* deepest background */
--gold:      #FFCA17;  /* CTAs, highlights, the star */
--gold-sh:   #D9A600;  /* hard offset shadow under gold buttons */
--cyan:      #22DAFF;  /* glow accents, live indicators, links on dark */
--sand-1:    #F7E3B2;  /* Sand Stripe start */
--sand-2:    #F2CD7E;
--amber:     #E5AE4A;  /* Sand Stripe end */
--ink:       #101A38;  /* ALL text/outlines — never pure black */
--paper:     #F7EFDD;  /* certificates, tickets */
```

Dark sections: gradient `#091D52 → #051036` with a faint blueprint grid overlay (1px lines, `rgba(120,175,255,.12)`, 110px major grid). Light sections: white / `#F5F8FF`.

### Typography (Google Fonts)

- **Baloo Bhaijaan 2** (700–800): all headlines, buttons, numbers, stage words
- **IBM Plex Sans Arabic** (400–700): body text both languages
- **IBM Plex Mono** (500–600): ALL-CAPS tracked labels, dates, license line, annotations — the “engineering voice”

### Signature components (must exist)

- **Glass cards:** translucent panels `background: rgba(255,255,255,.08)`, `backdrop-filter: blur(14px)`, 1px `rgba(255,255,255,.18)` border, soft glow — used for pricing, booking steps, testimonials on dark sections
- **3D tilt program cards:** perspective tilt following cursor (max ~8°), premium box feel, gentle lift+shadow on hover; disable tilt on touch devices (tap = subtle scale)
- **Motion:** scroll-reveal (IntersectionObserver, rise+fade), shine sweep across gold buttons on hover, pulsing glow dot on the LIVE ticker; respect `prefers-reduced-motion` everywhere
- **Buttons:** Baloo 800, gold `#FFCA17` with hard offset shadow `0 6px 0 #D9A600`, press-down on active; secondary = dashed 2.5px outline on dark
- **Dashed cyan annotations:** `#22DAFF` dashed callout lines + Mono labels on hero illustration
- **Sand Stripe dividers** between major sections (per rule 5)

### Logo — the flippable Kite/Cap (inline SVG, use this exact geometry)

Golden diamond that reads as a flying kite AND a graduation cap seen from above. Two modes:

```svg
<!-- KITE MODE (nav, marketing, kids) -->
<svg viewBox="0 0 340 420">
  <path d="M170 316 Q 214 356 200 392 Q 190 416 226 414" fill="none" stroke="#E5AE4A" stroke-width="7" stroke-linecap="round"/>
  <rect x="196" y="338" width="22" height="22" rx="5" fill="#22DAFF" stroke="#101A38" stroke-width="5" transform="rotate(45 207 349)"/>
  <rect x="186" y="378" width="20" height="20" rx="5" fill="#F2CD7E" stroke="#101A38" stroke-width="5" transform="rotate(45 196 388)"/>
  <path d="M240 402 l7 15 15 7 -15 7 -7 15 -7 -15 -15 -7 15 -7z" fill="#FFCA17" stroke="#101A38" stroke-width="5"/>
  <g stroke="#101A38" stroke-linejoin="round">
    <polygon points="170,36 306,176 170,316 34,176" fill="#FFCA17" stroke-width="10"/>
    <line x1="170" y1="36" x2="170" y2="316" stroke-width="6"/>
    <line x1="34" y1="176" x2="306" y2="176" stroke-width="6"/>
    <polygon points="170,36 306,176 170,176" fill="#FFE066" opacity=".5"/>
    <circle cx="170" cy="176" r="16" fill="#1C54CB" stroke-width="7"/>
  </g>
</svg>
<!-- CAP MODE (certificates, official): same diamond flattened with band + tassel -->
<svg viewBox="0 0 260 240">
  <g stroke="#101A38" stroke-linejoin="round">
    <polygon points="130,44 246,104 130,164 14,104" fill="#FFCA17" stroke-width="9"/>
    <path d="M76 142 L76 188 Q130 216 184 188 L184 142" fill="#FFCA17" stroke-width="9"/>
    <circle cx="130" cy="104" r="12" fill="#1C54CB" stroke-width="6"/>
    <path d="M130 104 Q 198 118 202 168" fill="none" stroke="#E5AE4A" stroke-width="6" stroke-linecap="round"/>
    <path d="M202 168 l5.5 12 12 5.5 -12 5.5 -5.5 12 -5.5 -12 -12 -5.5 12 -5.5z" fill="#FFCA17" stroke="#101A38" stroke-width="4.5"/>
  </g>
</svg>
```

Nav lockup: kite mark + wordmark “Fun**Ademy**” (Fun in `--ink`, Ademy in `--blue`). On the home hero, the mark gently sways (±4°, 5s ease loop). Nice-to-have: on hover the kite rotates/morphs into cap mode.

-----

## 3. SITE MAP & PAGES

### `/` HOME (in this exact section order)

1. **Top bar:** enrollment note + phone `+966 50 555 8387` + WhatsApp link
1. **Nav:** kite logo lockup · links (البرامج، مسار التعلم، وطننا، الأسعار) · AR/EN switch · gold CTA «حصة تجريبية مجانية»
1. **Hero (dark, blueprint grid):** professional photo of kids building a robot as background layer with deep-blue overlay; headline «لا نعلّم أطفالنا عن الهندسة — بل نصنع منهم مهندسين» + EN mono subline; swaying kite mark; dashed-cyan annotation labels; two CTAs (gold trial / dashed outline «اكتشف البرامج»); trust ticks: حصص مباشرة دائماً · مدرّبون معتمدون · أعمار ٤–١٨
1. **LIVE ticker:** dark strip, pulsing cyan dot, scrolling this-week classes with seats left (from admin schedule)
1. **Stats bar:** ٧ برامج · أعمار ٤–١٨ · مجموعات صغيرة ٨–١٦ · الحصة الأولى مجانية
1. **Learning Path:** snaking SVG road with 7 stations in age order (Big Builders → Smartivo → Bricks Challenge → AlgoPlay → Galileo Technic → RoboToys → AlgoC), finish flag at AlgoC; stations link to program pages
1. **Programs grid:** 7 tilt cards grouped visually under the 3 fields (section 4 below); each card: field label, ages, lesson length, format chip, «احجز تجربة»
1. **Coding lab (dark):** photo of child coding; animated terminal ending in Arabic string; bullets (live instructor, small groups, parent summaries, certificates); AlgoC teen line: «أصغر الفصول لأعمق المهارات — ٨ طلاب كحد أقصى»
1. **وطننا campaign teaser:** Sand-Stripe framed banner → «أطفالنا يبنون وطننا» + countdown chip + link to `/watanona`
1. **Testimonials (glass cards) + real-photo polaroid slots** (dashed placeholders labeled for real class photos)
1. **Pricing (dark, glass):** single plan card per section 5 + sibling note + free-trial banner; gold-bricks photo background
1. **Certificate mockup** (paper `#F7EFDD`, cap-mode logo seal)
1. **FAQ accordions** (6 items; answers must match official program table)
1. **Footer:** kite logo, program links, contact, the fixed credit line (rule 3)
1. **Floating WhatsApp button** (pulse, prefilled AR message)

### `/programs/[slug]` — 7 pages

Hero in field color scheme (fields tinted: العالم من حولنا = gold, الميكانيكا = amber, البرمجة = blue/cyan), official data block (ages, duration, class cap, format), what kids build, term flow, FAQ, booking CTA.

### `/watanona` — campaign page

Full أطفالنا يبنون وطننا experience in the CURRENT palette (blue/gold/cyan + Sand Stripe — replace any old red/green campaign colors):

- Animated hero: crane lowers roof onto brick house, Riyadh skyline (Kingdom Centre arch + Mukaab cube + metro), Saudi-green flag allowed here only as the small waving flag
- Four-stage journey cards: بيتي → حيّي → مدينتي → وطننا
- **Live countdown** to 23 Sep 2027 16:00 AST (Mini Watan exhibition)
- **Interactive brick wall:** tap to place a brick (sand-tone colors), toast «مكعّبك أصبح جزءاً من الوطن!», shared counter via `GET/POST /api/bricks` (DB-backed, debounced, rate-limit 20/day/IP)
- Exhibition ticket visual + sponsor packages section + CTA

### `/book` — trial booking

Steps (glass cards): choose program (7 official) → choose slot (from admin schedule, durations must match program: 45/75/90 min) → format question «أونلاين أم حضوري؟» → parent details (name, phone, child first name + birth year) → confirmation + WhatsApp deep link. Saves to DB. One-line AR privacy note.

### `/contact` — WhatsApp, phone, email, «نخدم مدينة الرياض — أونلاين للجميع».

### `/admin` (env-var password)

Schedule slots CRUD (feeds ticker + booking) · bookings list with CSV export + contacted/enrolled flags · testimonials & FAQ editor · brick counter view/reset.

-----

## 4. OFFICIAL PROGRAM CATALOG (replace ALL program data)

Three fields → seven programs:

**العالم من حولنا · The World Around Us**

|Program     |Ages|Lesson|Class cap|Format   |
|------------|----|------|---------|---------|
|Big Builders|4–6 |45 min|12       |in-person|

**الهندسة الميكانيكية · Mechanical Engineering**
| Bricks Challenge | 6–10 | 75 min | 16 | in-person |
| Galileo Technic | 7–10 | 75 min | 16 | in-person |

**البرمجة والروبوتات · Coding & Robotics**
| Smartivo | 4–6 | 45 min | 12 | live online / in-person |
| AlgoPlay | 6–10 | 75 min | 16 | live online |
| RoboToys | 9–12 | 90 min | 16 | live online |
| AlgoC | 13–18 | 90 min | 8 | live online |

Arabic one-liners:

- Big Builders: «يبني الصغار العالم من حولهم — أول مفاهيم العلوم بالمكعّبات والقصص»
- Bricks Challenge: «أساسيات الميكانيكا الكلاسيكية: تروس وروافع ونماذج تتحرك بمحركات حقيقية»
- Galileo Technic: «الميكانيكا المتقدمة لبنّائين جاهزين للتحدي الأكبر»
- Smartivo: «جميع أساسيات البرمجة للصغار — ملموسة أو على الشاشة»
- AlgoPlay: «أساسيات الروبوتات: تركيب وبرمجة على الشاشة»
- RoboToys: «الروبوتات المتقدمة — مشاريع أعمق ومنطق أذكى»
- AlgoC: «هندسة البرمجة والروبوتات للمراهقين — الطريق إلى التطوير الحقيقي»

-----

## 5. PRICING (single model — remove all legacy prices)

- **SAR 1,380 / طفل / برنامج شهرياً** — includes 4–6 sessions per month
- Sibling discount **−10%** per additional child
- **First trial class FREE**
- Value bullets beside price: مدة الحصة حسب العمر (45/75/90 دقيقة) · مجموعات صغيرة (8–16 كحد أقصى) · منهج وشهادات YE الرسمية · تقرير للأهل بعد كل حصة
- Delete every trace of SAR 330 / 380 or any per-track pricing.

-----

## 6. TECH

Next.js App Router + Tailwind + Prisma/Postgres. i18n with AR default + `/en`. SEO meta per locale, OG tags, sitemap. Images: keep current professional photos (hero kids-building-robot, coding child, testimonials group, gold-bricks pricing bg) — lazy-loaded, with deep-blue overlay for text contrast. WhatsApp click tracking counter in DB.

## 7. SEED DATA

7 programs per catalog · 14 schedule slots (evening online 45/75/90-min matching program durations; Saturday morning in-person for the three building programs) with some “2–3 seats left” · 3 testimonials (Saudi parent names, no neighborhoods) · 6 FAQs consistent with catalog · brick counter = 1847 · admin creds in README.

## 8. FINAL QA CHECKLIST (run and report each ✓)

- [ ] Zero occurrences of neighborhood names / “territory” / sub-city geography (grep the whole repo)
- [ ] Zero multicolor stripes; Sand Stripe only
- [ ] “FunAdemy” spelling everywhere incl. Arabic sentences; footer credit exact
- [ ] Ages 4–18 everywhere; program table matches section 4 exactly (ages, durations, caps)
- [ ] Only SAR 1,380 pricing model exists
- [ ] RTL mirrors perfectly on `/`; `/en` clean LTR
- [ ] Countdown targets 2027-09-23T16:00+03:00; brick API works and rate-limits
- [ ] YE logo = file or dashed placeholder only
- [ ] Lighthouse mobile ≥ 90 performance/accessibility; reduced-motion respected