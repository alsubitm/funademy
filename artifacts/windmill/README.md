# FunAdemy Virtual Engineering Lab — Windmill BC.013

An instructor-guided digital companion for Young Engineers Bricks Challenge learning. Children (6–12) build the BC.013 brick windmill in 14 stages, then run the motor to see a small gear drive a large gear, the main axle and four yellow blades.

No backend, no sign-in, no trackers, no personal data. Progress stays in browser `localStorage` only.

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
| `src/pages/Lab.tsx` | The single-page lab (header, lesson header, steps / build mat / parts tray, dialogs). |
| `public/brand/ye-logo.svg` | Local copy of the official Young Engineers logo. |

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

## Test report

11 automated tests pass against the actual lesson configuration: fourteen distinct stages, ordered placement and wrong-target rejection, incremental progress, completion, undo/reset, validated restoration and language, demo isolation and gear-motion ratios. TypeScript and the production Vite build pass.

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
