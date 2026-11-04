# FunAdemy Engineering Lab (/lab)

Original FunAdemy practice activity **Gear-Driven Fan**. It is *not* an approved Young Engineers lesson.

## Sharing the class link
- Arabic: `https://<site>/lab` — English: `https://<site>/en/lab` (toggle in the header).
- No account, no names, no contact details. First-time visitors start with an empty bench; returning visitors resume their device's saved build. Use Reset to start again.
- Linked quietly from the homepage footer ("Practice gear lab").

## Instructor demo
Tap **Instructor demo** in the header. Next/Back places one step at a time; **Run** spins the mechanism.
The demo uses its own state: it never changes, saves, or reveals a student's build.

## Progress
Saved only in the browser's `localStorage` under `funademy-lab:<lessonId>:v<version>`.
On load it is re-validated against the lesson rules; invalid or outdated data is discarded.
**Reset** (tap twice) clears it. Bumping `version` in the lesson config invalidates old saves.

## Replacing the practice model
All lesson content lives in `src/lib/lab/` — controls read only from config:
- `types.ts` — `Lesson` schema (parts + quantities, axes, slots with accepted part/orientations/`requires`, steps with two hints, status/reason messages, reflection, success output part).
- `gear-fan.ts` — the practice lesson. Copy it, change parts/slots/steps/text, and pass the new lesson to `<LabApp lesson={...}>` in `src/app/(ar)/lab/page.tsx` and `src/app/en/lab/page.tsx`.
- `engine.ts` — pure logic: `canPlace`, `placePart`, `removePart`, `dependentsOf`, `simulate`, `currentStep`, `placementsForSteps`, `validatePlacements`, `remaining`, `totalPieces`, `partAngle`.
Part illustrations are original SVG in `src/components/lab/Mechanism.tsx` (keyed by part id); swap in approved artwork there.

The current renderer supports this front-view base/support/axle/gear/crank/rotor family. New kinds of parts or different viewing geometry need corresponding original or approved artwork in that renderer; changing the config alone does not create new illustrations.

## Verification
- Desktop Chromium, 1440×900: mouse drag and click assembly, keyboard placement, invalid part/orientation feedback, partial motion, completion/reflection/replay, undo, delayed reset, refresh recovery and separate instructor demo.
- Touch-emulated Chromium, 390×844: full Arabic tap-and-rotate assembly, successful motion and completion, rotor removal, two-stage hints, and no page-level horizontal overflow. The tray scrolls horizontally within the page.
- 18 unit tests cover placement/dependency rules, stock limits, missing crank/gear/rotor, disconnected gears, opposite-direction motion, immutable edits and saved-state validation. TypeScript check passes.
- No physical phone, Safari or Firefox testing was performed. The 10–15 minute duration is a lesson target, not yet validated in a classroom pilot.

The feature is available in workspace Preview. Publish the site before sharing its public `/lab` or `/en/lab` link with students.
