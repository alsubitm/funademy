---
name: Instructor panel scope
description: Private instructor workspace, account provisioning and lab integration boundaries.
---

The user wants the engineering lab in a dedicated, detailed instructor control panel, not a link in the public website menu.

**Why:** They explicitly rejected public-menu placement and requested a professional instructor area.

**How to apply:** Keep teaching resources accessible from the instructor workspace and staff management from Admin. Do not add public navigation links without approval.

Keep staff access separate from family and administrator access. Accounts are administrator-provisioned; instructors only receive assigned teaching records and their own preparation notes, not financial or parent-contact data.

**Why:** The existing site had an administrator panel but no instructor role. Reusing the administrator password for teachers would grant unrelated permissions; introducing a different identity provider would disrupt the existing authentication system.

**How to apply:** Preserve account revocation and assignment checks on the server. Administrator preview is read-only for instructor-private preparation notes. The anonymous Windmill lab remains device-local and embedded as a teaching resource; embedding does not itself make its standalone URL private.
