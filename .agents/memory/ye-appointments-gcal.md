---
name: YE appointments via Google Calendar connector
description: How FunAdemy's appointment/Meet system works and its invariants
---

- Meetings are created via `@replit/connectors-sdk` → `connectors.proxy('google-calendar', '/calendar/v3/...')` with `conferenceDataVersion=1` + `conferenceData.createRequest.requestId` for an auto Meet link; guest email invites are sent by Google itself (`sendUpdates=all`). No separate email provider exists or is needed.
- **Consult slot uniqueness** is enforced by the nullable-unique `Appointment.consultKey` (ISO startsAt for scheduled consults, null otherwise). Claim the row FIRST (catch P2002 → 409), then create the Meet event, delete the row if Google fails. Cancelling a consult must null/delete consultKey or the slot stays blocked.
- **One class occurrence = one meeting**: trial bookings reuse an existing trial appointment's calendar event for the same program+startsAt and add the guest via PATCH attendees, instead of creating parallel meetings.
- Public booking endpoints (`/svc/appointments`, `/svc/bookings`) call the privileged Calendar connector, so they carry in-memory rate limits (`src/lib/rate-limit.ts`); a durable/WAF-grade control is still an open follow-up.
- **Why:** review found double-booking races and per-child duplicate meetings; these invariants prevent regressions when touching appointment flows.
