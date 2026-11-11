# FunAdemy online classes: adaptation and release gates

## Scope

The owner approved adapting this existing FunAdemy project to the Online Classes
brief dated 11 November 2026. This is not the separate PHP classroom import.
Keep the existing Next.js 15 / Prisma / PostgreSQL application and Windmill
companion. Do not replace the stack with NestJS or Redis just to match the
brief's description of a different project.

Phase 1 is **not complete**. Phase 2 and Phase 3 must not be declared complete
or started as new scope before Phase 1 acceptance passes. Existing learning
features may be reused without removing them.

## Existing implementation inspected before changes

| Area | Existing implementation | Gap against the new brief |
| --- | --- | --- |
| Public site | Arabic and English homepage, programmes, trial booking and enrolment routes | Bright Play redesign and online-course messaging; complete site-wide copy/configuration audit |
| Parent sign-in | Saudi mobile OTP, signed family session | Versioned terms/privacy and independent recording consent; registration field reconciliation |
| Family records | Family and Student models; first name, birth year; optional family email | Brief permits no email but requires email confirmations; existing child national IDs conflict with the new limited field list |
| Child area | Family-linked learning profiles, PIN hashing, lessons and progress | Learning profiles are distinct from enrolled students; link identities explicitly, never match by name alone; child-specific live entry and inactivity expiry |
| Programmes/groups | Program, CourseRun, ClassSession, capacity and enrolment records | Owner-managed January offer, tax settings, scheduling clashes, online course preparation |
| Payments | Existing checkout/cart, payments/items, provider return and webhook paths | Do not treat existing receipt as a compliant Fatoora invoice; verify all required methods in provider sandbox and add tax/invoice lifecycle |
| Parent home | Account/portal, sessions, payment receipts, attendance and make-up requests | Recording consent gate, next-class timing, appropriate renewal/progress integration |
| Teaching | Assigned instructor access, sessions/attendance, live Windmill trial controls | Second verification step, run-sheet configuration, per-child join evidence and confirmed attendance |
| Owner | Administrative programme/group, payment and instructor routes | Owner identity/second factor, configurable discounts/taxes, full administrative audit |
| Communications | Existing messaging and trial communication code | Verify paid-course confirmation/reminder delivery, retries and deduplication; no sends were performed in this inspection |

These are code-inspection findings, not fresh end-to-end acceptance results.

## Specific security gaps observed

- `src/lib/portal-sessions.ts` currently includes pending as well as active
  enrolments. Its `joinUrlFor` chooses an online meeting URL without a
  ten-minute release check. Upcoming queries omit classes once they start.
  Replace this with a server-enforced enrolment, time and session-state gate,
  including in-progress sessions, and persist join clicks before redirecting.
- The same helper selects recording links without a group-wide consent check.
  Versioned recording permission must gate release server-side.
- Existing kid authentication admits legacy plaintext PIN verification for
  backwards compatibility. Transition existing records safely; never expose
  PINs or invalidate a family without an account recovery path.
- Instructor authentication inspected here uses email/password and a signed
  session, not the required second verification step.
- National-ID fields support existing NELC workflows. Do not drop those fields
  or delete existing identity records as an unannounced side effect of this
  redesign. Agree the retention/reporting policy first.

## Owner decisions and external release gates

1. **Saudi data residency.** Replit's published geography documentation did not
   list Saudi Arabia among the available regions when checked. The present
   database has not been certified as Saudi-hosted. Obtain a confirmed
   Saudi-hosted PostgreSQL destination and a reviewed migration/retention
   plan before any move. Consider application processing, backups, logs,
   uploads and service providers as well as the database itself.
2. **Email — resolved.** The owner approved optional parent email.
   Confirmation emails apply only when an address is supplied; do not block
   registration without email. Wiring this consistently remains Phase 1 work.
3. **Districts.** The brief simultaneously prohibits place names other than
   Riyadh and asks for an owner-maintained district selector. Resolve that
   conflict before collecting district data.
4. **Fatoora and tax.** Confirm the legal seller, VAT registration/treatment,
   applicable invoicing phase and compliant integration requirements. Do not
   invent tax identifiers or describe a generic HTML receipt as compliant.
5. **Payment testing.** Provider credentials may enable real payments in this
   codebase. Use isolated sandbox credentials/data; do not charge a real card
   or send real SMS/WhatsApp/email during acceptance testing.
6. **Communications.** Verify the selected WhatsApp sending integration and
   approved templates; a WhatsApp contact link is not automated delivery.

Official region reference:
https://docs.replit.com/features/publishing/project-geography

## Acceptance record

| Brief check | Current result |
| --- | --- |
| Whole-product brand/geography/licensor/price scan | Not passed; configuration isolation is broader than the homepage |
| Arabic and English 390px parent-to-paid journey | Not run; revised registration, invoices and confirmations incomplete |
| Cross-group meeting access denied | New child entry path not implemented; existing portal gap recorded above |
| Full group rejects enrolment and offers waiting list | Existing capacity code needs the specified integrated acceptance pass |
| Platform works with licensor configuration removed | Homepage fallback is a first step only; full-platform check outstanding |
| Limited fields and Saudi-hosted personal data | Blocked by data-policy and hosting decisions |
| Built/reused/unfinished/decisions reported | This inventory distinguishes existing code from completed work |

No publishing, DNS edits, database relocation, record deletion, real payment
or external message sending is authorized by this readiness document.

## Completed foundation

- Arabic/English homepages use the new Bright Play palette and January 2027
  online-course preparation copy, with links to existing enrolment, trial,
  parent and instructor pages.
- Homepage programme definitions and the approved footer credit have moved to
  `src/config/curriculum.ts`. Components handle a null configuration. This is
  not yet the required database-backed, platform-wide configuration layer.
- Homepage metadata no longer leads with curriculum-licensor branding.
- The existing contact details, kite-to-cap animation, accounts, checkout and
  records were preserved. No schema or personal-data changes were made.
- TypeScript checking passed. The Arabic homepage rendered at 390px in Preview.
  Protected account/payment flows were not changed or acceptance-tested.

## Saudi-hosted PostgreSQL shortlist

Recommendation: **Google Cloud SQL for PostgreSQL in `me-central2`**, subject to
commercial onboarding and architecture review. Official PostgreSQL location
and region-availability documentation lists that Saudi region. For customers
with a Saudi billing address, Google directs purchase and regional access
through **CNTXT**. Request a quote rather than assuming a free-tier price.

Alternative: **Kloudbean-managed PostgreSQL in the same Saudi region**. The
vendor states that its managed databases and automatic backups can remain
in-country. This is a vendor claim, not an independently verified compliance
assessment; obtain a written service scope, backup locations, support-access
terms, SLA and full quote before selecting it.

Before either option is provisioned:

- Verify PostgreSQL version/Prisma compatibility and migration requirements.
- Specify Saudi locations for database, backups, restore copies and exports.
- Use encrypted authenticated connections and least-privilege credentials.
  Do not open database ingress to all IP addresses to make deployment easier.
- Review the app's own hosting, sessions, logs, uploads and third-party
  processors: putting only the database in Saudi Arabia does not keep all
  personal-data processing there or establish PDPL compliance.
- Rehearse migration using synthetic data first, then approve a backup,
  reconciliation, rollback and cutover plan before moving real records.

Verified sources:

- https://docs.cloud.google.com/sql/docs/postgres/locations
- https://docs.cloud.google.com/sql/docs/postgres/region-availability-overview
- https://docs.cloud.google.com/docs/dammam-region-access?hl=en
- https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/backups
- https://www.kloudbean.com/blog/managed-databases-saudi-data-sovereignty

No provider has been selected, no quote accepted and no resource purchased.
