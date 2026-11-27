# Curriculum browser regressions

Run `pnpm --filter @workspace/ye test:browser` (install Chromium once with
`pnpm --filter @workspace/ye exec playwright install chromium`).
On systems with a preinstalled Chromium, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable.

The runner starts its own Next server on port 3107 with a separate build
directory, provisions the existing fail-closed `ye_test` database, and uses
test-only signed admin/family/child sessions against real authorization
guards and API/database persistence. Do not run alongside Vitest or another
browser suite using that database. No production/dev family data is modified.
The server inherits only a small OS environment allowlist, not live provider
credentials. Fixtures have unique identifiers and are deleted after the run.

Coverage: language metadata and independent Vimeo/YouTube player types survive
save/reload/reopen; clearing the alternate persists; English hides an Arabic-only
original while Arabic still renders it; importing an untranslated exercise and
deleting it refresh English readiness when the exercises dialog closes.
English and bilingual originals also cover MP4 English alternates (native video,
source URL, and controls), independent Arabic playback, and persisted fallback to
the eligible original after the alternate is cleared and the editor reopened.

External iframe documents and MP4 responses are stubbed so the suite asserts application player
selection and embed URLs, not third-party video delivery or decoding.

`chat-viewport.spec.ts` exercises the English and Arabic widget at a short
390×740 browser viewport. It substitutes a deterministic `VisualViewport`
event target to check resize and scroll handling, reachable composer/close
controls, focus restoration, and reduced-motion styling. A second scenario
scales the page root text to 150%, then checks long localized replies, links,
suggestions, action cards, scrolling, and pinned controls. This is browser
emulation only; it does not claim physical iPhone or keyboard coverage.
Failure traces go to ignored `generated-artifacts/browser-tests`.

## Four-panel regressions

Run `pnpm --filter @workspace/ye exec playwright test browser-tests/panels.spec.ts`
with the same isolated server and provider-free environment described above.
The fixtures include two same-name course students and two separate same-name
learning profiles. Tests cover admin URL/history/filter/reset/error states and
all mobile destinations; instructor class handoffs, attendance failures, private
note save failures and draft-safe refresh; Arabic/English child-preserving portal
links, wrong/right PIN selection, unavailable lessons, parent-exit gates, and
learner session/enrollment/network recovery; and the admin progress class
picker paging/searching to an older class beyond the first server page, then
loading its roster and student progress. A second progress scenario checks
that reload restores the URL-saved class, student and skill status, that
Back/Forward step between two chosen classes and students, and that an
inactive or deleted saved class shows the unavailable notice and clears
`prun`/`pstudent`. Only deliberate failure responses
are intercepted; successful writes use the real authenticated services.

Browser evidence uses Chromium at desktop 1280×720, tablet 768×1024 and phone
390×844. This is viewport emulation, not physical-device, Safari or Firefox
coverage. Screenshots are saved in ignored `generated-artifacts/panels-evidence`.

The chat regressions also cut off a real, committed reply after a partial
delta (both truncated EOF and a reader error), then retry with the same send
identity. English and Arabic checks verify one saved prompt and reply after
reloading and reopening history. Only delivery is interrupted; conversation
creation, reply persistence, replay, and transcript loading use real handlers
against `ye_test`.
