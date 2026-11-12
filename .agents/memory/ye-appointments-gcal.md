---
name: YE appointments via Google Calendar connector
description: How FunAdemy's appointment/Meet system works and its invariants
---

- Shared meeting invitations use Google Calendar. Private student capability links must use separate, single-guardian transactional messages; never place them in shared event descriptions. See [Private invitation email safety](private-invitation-email.md).
- **Consult slot uniqueness** is enforced by the nullable-unique `Appointment.consultKey` (ISO startsAt for scheduled consults, null otherwise). Claim the row FIRST (catch P2002 → 409), then create the Meet event, delete the row if Google fails. Cancelling a consult must null/delete consultKey or the slot stays blocked.
- **One class occurrence = one meeting**: trial bookings reuse an existing trial appointment's calendar event for the same program+startsAt and add the guest via PATCH attendees, instead of creating parallel meetings.
- Public booking endpoints (`/svc/appointments`, `/svc/bookings`) call the privileged Calendar connector, so they carry in-memory rate limits (`src/lib/rate-limit.ts`); a durable/WAF-grade control is still an open follow-up.
- **Why:** review found double-booking races and per-child duplicate meetings; these invariants prevent regressions when touching appointment flows.

# Account swap behavior

**Rule:** Re-authorizing the calendar connection switches the acting Google account instantly for workspace AND the deployed site (connection is environment-level, no republish). Events created before the swap stay on the old account's calendar: attendee-add on them 404s (caught and logged in the booking route; booking still succeeds and the stored meet link keeps serving), and cancel already tolerates 404/410.

**Why:** Owner swapped Meet accounts mid-operation with an upcoming trial booked; verified nothing breaks, but old events can no longer be auto-modified through the site.

**How to apply:** After any account swap, check prod for upcoming scheduled appointments with a stored calendar event and tell the owner those stay manageable only from the old account; verify the connected account with a `calendars/primary` read, and remember event times are created with explicit Riyadh timezone regardless of the account's own display timezone.

# Connector imports in scheduled workers

**Rule:** Never import the Google connector dependency into Next instrumentation. Keep connector work behind a protected server route and let the in-process timer call that route over localhost.

**Why:** The connector SDK depends on `node:child_process`; Next's instrumentation compiler cannot bundle it and will make every page return 500 even though normal route bundles support it.

**How to apply:** Any periodic Calendar job should persist work first, expose an internal authenticated worker route, and keep instrumentation limited to a lightweight localhost trigger.
