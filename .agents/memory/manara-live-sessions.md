---
name: Manara live-sessions platform
description: Where the live-sessions feature lives and its client/validation conventions
---
- The live-sessions platform (booking, packages, waitlist, join gating) is api-server `/api/sessions` + Manara frontend (`/app/sessions`, `/admin/sessions`) — NOT the YE artifact; YE has its own separate Prisma-based course sessions.
- **Why:** sessions backend uses Manara's email/cookie auth and Drizzle DB; YE families use phone-OTP `ye_family` cookies — two separate user systems.
- API client & zod schemas are generated (orval) in `lib/api-client-react` and `lib/api-zod` — never edit generated files; input hardening (e.g. http(s)-only URL sanitization for meeting/material links) goes in the Express routes.
- Join links are revealed 15 min before start; frontend must poll my-bookings while a detail page is open so server-side waitlist promotion surfaces without reload.
- Demo accounts: parent/teacher/admin @demo.manara.sa (seeded), flow test: `pnpm --filter @workspace/api-server run test:sessions`.
