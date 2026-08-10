---
name: Task-merge clobber risk
description: Platform task merges can silently revert main-branch work on shared files; how to detect and recover
---
- Task agents branch from main at assignment time and their merges land as squashed tree snapshots. A merge from a STALE base can silently revert files that main gained after the branch point — even files the task never meant to touch.
- **Why:** observed live: an SEO task's merge wiped just-completed NELC verifier fixes from route/lib files it had no business changing; a later NELC task then added UI referencing a state field its stale base lacked, breaking the production build (type error only surfaced in `next build`, not in the dev server).
- **How to apply:** after any task-merge notification that overlaps files you recently changed, content-grep those files for your key symbols before trusting HEAD. To recover, find your commit (`git log --all -S "<symbol>"` — platform may rename commit messages), `git checkout <commit> -- <files>` to restore, then hand-merge the task's intended additions. Memory files under `.agents/` can be clobbered the same way — re-check recent memory edits too.
- The dev workflow won't catch type errors (lazy compilation) — run `tsc --noEmit` or the production build to verify HEAD actually builds after merges.
