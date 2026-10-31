---
name: pnpm audit override safety
description: Avoid losing existing security overrides or accepting unintended major upgrades during dependency remediation.
---

Check the root override diff after running `pnpm audit --fix`, including when invoked from nested directories.

**Why:** In this workspace, pnpm's auto-fix copied workspace YAML overrides into the root manifest and displaced existing root security overrides. It also proposed unbounded version ranges and a Zod major upgrade unrelated to the requested fixes.

**How to apply:** Preserve existing root security overrides, leave platform exclusions in the workspace configuration, and replace broad auto-fix suggestions with compatible direct upgrades or narrowly scoped transitive overrides. Run install afterward and verify the actual lockfile resolutions.
