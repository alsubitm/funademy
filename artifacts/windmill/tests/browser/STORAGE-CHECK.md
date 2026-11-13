# Storage-warning release verification

## Recorded result

- Date: 2026-11-13.
- Runner: GitHub Actions `ubuntu-24.04`, Node 22, pnpm 10.26.1.
- Result: **48 passed**, no skipped storage-notice cases.
- Each of `chromium`, `chromium-touch`, `firefox`, `firefox-touch`, `webkit`
  and `webkit-touch` passed eight cases.
- Version-matched Firefox 157.0 and WebKit 27.2 were installed with their native
  dependencies by Playwright, along with Chromium.
- Tested GitHub revision: `0cf07974dc2299bf01864ad46e8122bf5c8e6573`.
- Evidence: https://github.com/alsubitm/funademy/actions/runs/43350358402
- Workflow pull request: https://github.com/alsubitm/funademy/pull/1
- The run retained its HTML report as `windmill-storage-results` for 14 days.

The workflow branch was based on the then-current GitHub main branch. Only the
workflow and focused package command were added; existing lesson tests and all
configured projects were retained. The repository main branch was not changed
and no app was published by this verification.

## Repeat on a supported runner

From the repository root:

```sh
pnpm install --frozen-lockfile --filter @workspace/windmill...
pnpm --filter @workspace/windmill exec playwright install --with-deps chromium firefox webkit
pnpm --filter @workspace/windmill test:browser:storage
```

The committed workflow performs these steps on relevant pushes and pull
requests. Once merged into the default branch, it is also manually runnable
from GitHub Actions. A future release needs a successful check for its own
revision; this result is not a permanent pass for later source changes.

## Scope and privacy

The unchanged `storage notice:` regressions cover denied storage access, failed
writes, malformed JSON and stale save versions, in Arabic and English. They
check warning text, continued building, language switching, discarded-data
dismissal, refresh reset after failed persistence, and successful fresh saves
after invalid data is discarded.

Every case uses a new anonymous browser context. The existing request guard
blocks unexpected destinations and methods and permits only local lesson GETs.
No cloud progress, backend, provider, sign-in or personal data is used.
Service workers remain blocked by the existing Playwright configuration.

Touch projects are emulation, not physical-device testing. Playwright WebKit
is not installed Safari. The check injects storage failures deterministically;
it is not a claim that every browser's real private-browsing or eviction policy
has been reproduced. Other lesson journeys are outside this focused result.
