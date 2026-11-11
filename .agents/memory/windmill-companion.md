---
name: Windmill companion scope
description: Source fidelity, classroom use, branding and privacy constraints for the engineering lab.
---

The user removed the generic Gear-Driven Fan lab and requested the actual Young Engineers Bricks Challenge Windmill BC.013 companion, supplying the complete building guide.

**Why:** They explicitly require a recognizable brick-built windmill, its 14-stage construction sequence, separate motor platform and four blades—not a simplified fan or generic gears game.

**How to apply:** Use the supplied guide as visual reference, produce original SVGs, and never embed full scanned guide pages. Treat the app as “an instructor-guided digital companion,” not an independently official Young Engineers platform. This supports the in-person classes; it does not change the in-person-only delivery policy.

Keep this pilot anonymous and device-local: no registration, children's names, contact details or advertising trackers.

**Why:** These are explicit requirements of the Windmill brief.

**How to apply:** Preserve student progress when demonstrating. Any future cloud progress or instructor accounts need a separately authorized scope.

Online instructor-led trials are a separately authorized scope: siblings may share one guardian email, and even students with the same name must remain separate entries with private links, independent results and revocation, within sixteen student seats. Only the same request's room-scoped idempotency key identifies a retry; guardian email and name are never deduplication keys.

**Why:** The user explicitly requested family-shared contact details without merging student identities. The anonymous standalone companion rule does not prohibit this trial workflow.

**How to apply:** Treat guardian email as contact information, not student identity; Calendar membership is per guardian email while trial access is per child. Generate a fresh key for each deliberate invitation and reuse it only while retrying that invitation.

The PDF does not specify gear tooth counts. The prototype's numerical gear ratio is an explicitly labeled teaching schematic.

**Why:** Claiming unverified physical-kit specifications would misrepresent the provided reference.

**How to apply:** Retain the illustrative-ratio disclosure unless the owner supplies verified kit tooth counts; keep drawn gear teeth and animation speed ratios consistent.

Additional engineering experiments and alternate inspection views must remain explicitly schematic and separate from the original guided BC.013 build.

**Why:** The user approved exploratory controls and challenges, not changes to the supplied kit's construction instructions. Preserving that distinction avoids implying that experimental gear configurations are included in the kit.

**How to apply:** Keep exploration state separate from saved student construction. Optional narration uses device speech voices, with explicit unavailability rather than silently falling back to the wrong language.

Offline support must remain opt-in and confined to the Windmill lesson, with no accounts, student identifiers, or tracking. Shell upgrades must not reset validated local lesson progress.

**Why:** The classroom outage requirement is explicitly separate from the main site's private account, booking, payment and admin flows.

**How to apply:** Never widen offline caching to the main site or bump lesson schema versions merely for shell updates. Verify offline behavior against built assets, not the development/HMR server.

Prefer conservative offline-shell cleanup over a hard retention cap: an old,
legacy, or frozen lesson tab that cannot confirm its document version must block
automatic pruning.

**Why:** Classroom tabs can remain open offline for long periods. Silence or a
new controller does not prove an older document has stopped needing its assets.

**How to apply:** Establish document-version agreement before deleting old
copies; keep future waiting installs outside the cleanup candidates. Do not
introduce a timeout that interprets an unresponsive tab as safe to discard.
