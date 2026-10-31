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

External iframe documents are stubbed so the suite asserts application player
selection and embed URLs, not third-party video delivery or decoding.
Failure traces go to ignored `generated-artifacts/browser-tests`.
