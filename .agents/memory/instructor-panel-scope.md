---
name: Instructor panel scope
description: Private instructor workspace, account provisioning and lab integration boundaries.
---

The user wants the engineering lab in a dedicated, detailed instructor control panel, not a link in the public website menu.

**Why:** They explicitly rejected public-menu placement and requested a professional instructor area.

**How to apply:** Keep teaching resources accessible from the instructor workspace and staff management from Admin. Do not add public navigation links without approval.

Keep staff access separate from family and administrator access. Accounts are administrator-provisioned; instructors only receive assigned teaching records and their own preparation notes, not financial or parent-contact data.

**Why:** The existing site had an administrator panel but no instructor role. Reusing the administrator password for teachers would grant unrelated permissions; introducing a different identity provider would disrupt the existing authentication system.

**How to apply:** Preserve account revocation and assignment checks on the server. Administrator preview is read-only for instructor-private preparation notes. The standalone Windmill lab remains device-local; instructor-led sessions are a separate shared experience, not a change to anonymous progress.

Online free trials are instructor-led: students observe the instructor's model and take a test only when the instructor unlocks it. Both administrators and assigned instructors manage invitations and Meet scheduling.

**Why:** The owner explicitly requested instructor control, student viewing, and an end-of-session test, and selected online free trials as the Meet use case.

**How to apply:** Keep shared classroom state and test grading server-owned. Never let a student's local lab progress control the shared class. Keep private student invitation links out of shared Google Calendar descriptions and guest lists.

Provision instructor accounts in the environment where the user will sign in; a Preview account is not a live-site account.

**Why:** An account successfully tested in Preview was absent from the production database after publishing, causing the live login to report invalid credentials.

**How to apply:** Check account existence in the intended environment without selecting password hashes. For live provisioning, use the existing authenticated admin API, not production SQL writes or automatic startup seeding, and verify the live instructor login before confirming access.
