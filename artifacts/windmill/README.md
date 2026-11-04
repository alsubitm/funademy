# FunAdemy Virtual Engineering Lab — Windmill BC.013

An instructor-guided digital companion for Young Engineers Bricks Challenge learning. Children (6–12) build the BC.013 brick windmill in 14 stages, then run the motor to see a small gear drive a large gear, the main axle and four yellow blades.

No backend, no sign-in, no trackers, no personal data. Progress stays in browser `localStorage` only.

## Optional classroom offline copy

In a production build over HTTPS (or localhost), choose **Save for offline / حفظ دون اتصال** after the lesson loads. Wait for **Offline ready / الدرس جاهز دون اتصال** before disconnecting. Reopen the exact `/windmill/` address in the same browser. All fourteen stages, original SVG artwork, motor animation, hints, bilingual text and bundled fonts work locally. Browser storage may be cleared/evicted; check readiness before class. Private browsing may not retain it.

The build emits a content-versioned `sw.js` with an explicit manifest. Registration is opt-in and scoped exactly to `/windmill/`; the worker caches only the lesson HTML, built JS/CSS, bundled fonts, favicon and local logo. No runtime response caching, main-site routes, API calls, accounts, payment data or tracking. Development/HMR is deliberately not cached.

Updates install completely before a bilingual notice appears. Choose **Update and reload** at a convenient break; no forced reload. Worker versions never change or delete localStorage, and the existing lesson validator continues restoring progress, hints, language and motor-test status. Old shell caches are retained for open lesson tabs. **Remove offline copy** unregisters only this worker and removes only its caches; it does not reset progress. Keep the lesson schema version unchanged for shell-only upgrades.

Fonts are self-hosted copies of Baloo Bhaijaan 2, IBM Plex Sans Arabic and Space Mono from Google Fonts, licensed under SIL OFL (licenses alongside files in `public/fonts/`).

Production-mode verification: build, then `BASE_PATH=/windmill/ PORT=4173 pnpm --filter @workspace/windmill serve`. Use a fresh browser context at `http://localhost:4173/windmill/`, opt in, disable networking, reload and complete fourteen placements and the motor test. Re-enable networking, install a newly built shell, accept its update, and verify progress survives. `pnpm --filter @workspace/windmill test` also tests the cache boundary, incomplete installs, eviction detection and explicit update activation.

## Setup, run, build

```bash
pnpm install --filter @workspace/windmill
# dev (the Replit workflow sets PORT and BASE_PATH)
BASE_PATH=/windmill/ PORT=5173 pnpm --filter @workspace/windmill dev
pnpm --filter @workspace/windmill typecheck
pnpm --filter @workspace/windmill test
BASE_PATH=/windmill/ PORT=5173 pnpm --filter @workspace/windmill build   # output: dist/public/
```

Sharing path: the artifact is served under `/windmill/`. Every asset URL is built from `import.meta.env.BASE_URL` (e.g. `brand/ye-logo.svg`), so the app works under any base path. There are no hard-coded hosts.

## Structure

| Path | Role |
| --- | --- |
| `src/lib/lesson-engine.ts` | Pure lesson engine: placement, undo, reset, hints, motor test, demo progress, `motionAt`, validated restore. |
| `src/data/lessons/windmill.ts` | `windmillLesson` — all bilingual copy, steps, pieces, notes, hints, targets, SVG layer ids, completion text, tray order, transmission. |
| `src/i18n/ui.ts` | Shared English/Arabic UI strings (one component tree for both languages). |
| `src/components/parts/Bricks.tsx` | Reusable original SVG primitives: studded brick/plate/beam, cross axle, spur gear (exact tooth count), motor, slope, blade. |
| `src/components/model/WindmillModel.tsx` | Layered windmill drawing; one layer per stage; motion angles applied from `motionAt`. |
| `src/hooks/use-stored-progress.ts` | localStorage load/save via `restoreProgress`; storage failures are shown on screen. |
| `src/components/lab/*`, `src/components/model/InspectViews.tsx`, `src/hooks/use-motor.ts`, `src/hooks/use-narration.ts`, `src/i18n/features.ts` | Inspect dialog + zoom pane, schematic views, motor controls, challenges, narration, presentation mode, and their EN/AR strings. |
| `src/pages/Lab.tsx` | The single-page lab (header, lesson header, steps / build mat / parts tray, dialogs). |
| `public/brand/ye-logo.svg` | Local copy of the official Young Engineers logo. |

## Classroom features

- **Inspect model** (`button-inspect`): a separate dialog (the build mat and its targets are untouched) with four original vector schematic views: Front (the learner's actual build), Back (a dedicated rear elevation drawing, not a mirrored front), Gear connection (12T pinion meshing with 36T gear, axles 6 and 12, direction arrows) and Exploded assembly (blades, rotor hub, tower, bush, main axle, large gear, small gear, motor with labels). Unbuilt parts are dashed outlines, so an incomplete build stays incomplete. Zoom 100–400 %, pan by drag/touch, toolbar buttons or arrow keys, `+`/`-`/`0` keys; panning is clamped to the frame. All views are labelled as schematics, not kit replicas.
- **Install animation and preview**: each newly placed stage slides from an offset into place. `Show this step` previews the current step's parts for a few seconds without changing saved progress (placement target hidden meanwhile); `Replay last part` repeats the last installation animation. Reduced-motion users get an instant fade.
- **Motor controls** (only for a complete build or complete demo): continuous speed slider 0.25–2×, reverse, pause/resume (angle preserved; Stop resets), slow motion (0.25×). The driver angle is accumulated per animation frame with `advanceDriverAngle` and mapped through `transmissionMotion`, so speed/direction changes never jump. Arrows, live rpm and direction readouts follow the controls. With `prefers-reduced-motion`, playback runs at 0.3× and this is disclosed on screen.
- **Engineering challenges** (unlocked after a completed, motor-tested build, or a complete Instructor Demo): predict-then-test thought experiments (swap to 36:12, reverse the motor, equal 12:12) with a gear simulation drawn and animated from the stated tooth counts, explanations, redo and reset. Clearly labelled as separate from BC.013 and not a statement about kit contents; the saved build is never modified.
- **Read aloud**: optional browser `speechSynthesis` of the current instruction in the selected language. Never autoplays; explicit play/stop and a status line. It needs a device voice whose language matches (Arabic or English, detected including `voiceschanged`); otherwise it is shown as unavailable. Voice quality varies by device, it is synthetic (not human-recorded) and some devices need a network connection for their voices. Speech is cancelled on step, language, demo, dialog or presentation changes and on unmount.
- **Classroom presentation** (`presentation-open`): full-screen enlarged model and instruction with its own step counter (never reads or writes learner progress), toolbar prev/next, arrow keys that follow reading direction (RTL-aware), Escape to exit. Key presses from inputs, selects, buttons and other dialogs are ignored.

## Replacing or adding a lesson

Create another file in `src/data/lessons/` exporting an object of type `Lesson` (it extends the engine's `LessonRules`). Each step needs `id`, `partSetId`, `targetId`, `number`, bilingual `title` / `instruction` / `engineeringNote` / `hint` / `completion`, `pieces`, a `target` rectangle in model coordinates, `svgLayer: { id, bbox }` and `pdfPage`. Add matching layer drawings to the `LAYERS` map (or a new model component). Bump `version` whenever steps change — old saved progress is then discarded safely by `restoreProgress`.

## Source guide map (BC.013 PDF, cover = page 1)

| PDF page | Stages | What the guide shows |
| --- | --- | --- |
| 2 | 1–4 | Grey studded base, red U frame with green rear brick; two green braces on red supports; red studded bridge platform; second red course |
| 3 | 5–6 | Green perforated axle housing; alternating green/red upper courses and long black axle labelled 12 |
| 4 | 7–8 | Large and small grey gears with bushes on the main axle; red four-arm hub on the opposite end |
| 5 | 9–10 | Separate red/green base plate with yellow and dark grey perforated beams; grey motor, axle 6, drive gear |
| 6 | 11–12 | Motor platform joined to the tower so the gears mesh; yellow curved foot supports and red end pieces |
| 7 | 13–14 | Blue slope foot pieces and red top cap; four yellow studded blades on the red cross |
| 8 | — | Back cover (no build content) |

The PDF pages are reference only. No scanned page is bundled; every drawing is original SVG.

## Gear ratio (illustrative)

The printed guide does not state gear tooth counts. The lesson uses an **illustrative teaching ratio** in `windmillLesson.transmission`: driver 12 teeth, driven 36 teeth, driver 30 rpm, giving 3 : 1 reduction (blades 10 rpm) and opposite rotation. The SVG gears are drawn with exactly these tooth counts, and the UI labels the ratio as a schematic, not the exact kit. Change the three numbers to change both the drawing and the animation.

## Test ids

`language`, `demo`, `demo-panel`, `demo-prev`, `demo-next`, `demo-complete`, `progress`, `progress-count`, `stage-1`…`stage-14`, `status-tested`, `step-number`, `step-title`, `hint`, `text-hint`, `hints-used`, `undo`, `reset`, `reset-confirm`, `reset-cancel`, `reference`, `build-mat`, `placement-target`, `feedback`, `motor-status`, `run-motor`, `gear-ratio`, `part-set-1`…`part-set-14`, `storage-notice`, `dialog-reset`, `dialog-reference`, `dialog-complete` (each with `-close`), `reflection-option-1`…`-3`, `reflection-feedback`, `replay`, `footer-credit`.

New controls: `button-inspect`, `dialog-inspect`, `inspect-schematic-label`, `inspect-partial`, `inspect-view-front|back|gears|exploded`, `inspect-art-*`, `inspect-viewport`, `inspect-zoom-in`, `inspect-zoom-out`, `inspect-zoom-reset`, `inspect-zoom-level`, `inspect-pan-left|right|up|down`; `button-step-preview`, `button-replay-last`, `status-preview`; `motor-controls`, `motor-controls-locked`, `input-motor-speed`, `text-motor-speed`, `button-motor-reverse`, `button-motor-pause`, `button-motor-slow`, `motor-readout`, `text-motor-direction`, `text-motor-live`, `text-reduced-motion`, `arrow-driver`, `arrow-driven`; `button-challenges`, `text-challenges-locked`, `dialog-challenges`, `challenge-disclaimer`, `challenge-tab-swap|reverse|equal`, `challenge-title`, `challenge-option-1…3`, `challenge-test`, `challenge-redo`, `challenge-next`, `challenge-reset`, `challenge-feedback`, `challenge-sim`, `challenge-readout`; `button-narration-play`, `button-narration-stop`, `status-narration`; `presentation-open`, `presentation`, `presentation-prev`, `presentation-next`, `presentation-exit`, `presentation-count`, `presentation-instruction`.

## Test report

The six classroom features pass TypeScript and the production build. Targeted desktop/mobile Chromium checks verified all four inspection views, zoom/pan/reset, preview/replay without saving, presentation buttons/Escape, adjustable synchronized motor motion with pause/resume, and all three prediction challenges. Student progress remained unchanged throughout. No mobile horizontal overflow or console errors were observed. Presentation arrow-key navigation failed when a toolbar button held focus; that handler was corrected and typechecked after the browser pass. The test browser had no Arabic or English voices, so unavailable narration was verified but real audio playback was not.


17 automated tests pass: eleven cover the actual lesson configuration, fourteen distinct stages, ordered placement and wrong-target rejection, incremental progress, completion, undo/reset, validated restoration and language, demo isolation and gear-motion ratios; six cover continuous speed/reversal, pause preservation, synchronized outputs, experimental ratios and invalid motor inputs.

Browser verification used desktop Chromium at 1280×900 and touch-emulated Chromium at 390×844, not physical devices. English and Arabic layouts were checked, with full desktop construction and a full Arabic mobile tap build followed by an English switch. Verified mouse drag, keyboard placement, incorrect choices, hints, motor gating, reflection/replay, undo/reset, refresh restoration, demo isolation and the complete-model reference. Mobile pages have no horizontal overflow. Fresh-load console/network checks passed.

Live SVG transforms confirmed a driver change of +63.126 degrees and a driven change of −21.042 degrees over the same sample interval; axle and blades followed the driven gear. Reduced-motion idle effects were checked separately.

## Publishing

Use the workspace Publish action after reviewing Preview. The existing public domain was verified as `https://funademy.io`; the new lesson's intended public address after publishing is `https://funademy.io/windmill/`. The lab has **not been published by the build agent**.

The artifact serves `dist/public` as a static application under `/windmill/`, with SPA fallback. No database migration or secrets are required.

## Limitations and next lesson

- This is a guided, stage-set assembly, not a free-form CAD or collision/torque simulator.
- The original SVG is a readable schematic based on the guide, not an exact 3D replica. Tooth counts are illustrative as explained above.
- Touch placement uses tap-select then tap-target; mouse and pen also support dragging.
- Physical iOS/Android devices, Safari and Firefox have not been verified. Classroom timing and teaching effectiveness require a supervised pilot.
- New parts or model geometry require new original SVG layers; reusable lesson controls and engine remain unchanged.
- Recommended next lesson: an approved wheeled-vehicle activity contrasting gear reduction with wheel speed. Obtain its approved guide before authoring it; no particular Young Engineers lesson code is assumed.
