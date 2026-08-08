# Threat Model

## Project Overview

Manara Academy is an Arabic-first RTL e-learning platform for Saudi families. Children aged 4–18 follow the Saudi national curriculum; parents pay a family subscription (SAR 49/mo or 399/yr). The stack is Node.js 24 / Express 5 / PostgreSQL (Drizzle ORM) on the backend and React / Vite on the frontend. Sessions are stateless HMAC-signed cookies. The platform is not yet deployed to production.

## Assets

- **Parent credentials** — email + scrypt-hashed password + plaintext 4-digit PIN. The PIN gates the parent dashboard inside the child experience.
- **Child profiles and PINs** — names, birthdates, band placement, plaintext 4-digit PINs. PINs gate avatar/child selection.
- **Subscription and payment records** — plan, status, trial dates, card-last-4, invoices. Compromise could enable unauthorized access to paid content.
- **Curriculum content** — lessons, exercises, video URLs. Gated behind subscription; some content is public as free samples.
- **Learning progress** — completions, scores, XP, streaks, badges. Integrity matters for gamification and reporting.
- **Application secrets** — `SESSION_SECRET`, `DATABASE_URL`. Leaking the session secret allows forging arbitrary session tokens.

## Trust Boundaries

- **Browser → API** — all client requests. The API must authenticate and authorize each request; the browser is untrusted.
- **Public → Authenticated** — marketing/free-sample content is public; lesson content, progress, and subscriptions require a valid session.
- **Authenticated → Subscribed** — paid lesson content should require an active subscription in addition to a session.
- **Parent → Child** — child sessions are parent sessions with `childId` set after a PIN check. The parent gate (PIN) separates the two.
- **User → Admin/Teacher** — role-based; admin/teacher routes are protected by `requireRole`.
- **API → Database** — the Express server has direct DB access via Drizzle ORM; all queries use parameterized statements.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/routes/` (auth, children, curriculum, learning, parent, subscription, marketing, admin)
- **Auth helpers**: `artifacts/api-server/src/lib/auth.ts`
- **Highest-risk areas**: `learning.ts` (subscription bypass, client-scoring), `auth.ts` (rate limiting, PIN), `app.ts` (CORS)
- **Admin surface**: `/api/admin/*` protected by `requireRole("teacher","admin")`
- **Dev-only areas**: `artifacts/mockup-sandbox/`, `artifacts/watanona/`, `artifacts/ye/` — not part of the Manara API surface

## Threat Categories

### Spoofing

Sessions are HMAC-SHA256 signed cookies with a 30-day TTL. The `SESSION_SECRET` defaults to `"dev-secret-change-me"` if the env var is absent — if this default reaches production, any attacker knowing the default can forge valid sessions for arbitrary user IDs. No active deployment was observed at scan time.

### Tampering

Exercise scoring is computed server-side, but the correctness flags come from the client (`answers[].correct`). A child can submit all answers as `correct: true` to fabricate a perfect score, earn maximum XP, and unlock all badges. The server never re-grades answers against stored correct answers.

### Information Disclosure

- Parent and child PINs are stored as plaintext text columns. A database breach directly exposes all PINs.
- The dev email provider logs verification tokens to stdout. In production this provider must be replaced; the code guards `devVerificationUrl` behind a `NODE_ENV !== production` check so it is not leaked via the API in production.

### Denial of Service

No rate limiting exists on authentication endpoints (`/api/auth/login`, `/api/auth/register`, `/api/children/:id/select`, `/api/auth/parent-gate`). These are exposed to brute-force or credential-stuffing without friction.

### Elevation of Privilege

- The `/api/lessons/:id` endpoint checks for a valid session for non-free content but does NOT verify subscription status. An authenticated user with a cancelled or expired subscription can still fetch all paid lesson content and exercises.
- CORS is configured with `cors()` (no options), reflecting all origins. This is harmless for cookie-based auth today, but is a misconfiguration that should be locked to the app's own origin in production.
