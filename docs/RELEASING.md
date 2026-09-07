# Releasing okay

How a version of `okay` ships. Follow this without asking.

## What a release actually is

Installs track `main`. `/plugin marketplace update okay` pulls the default
branch and reads `.claude-plugin/marketplace.json` from whatever `main`
points at. **Pushing to `main` is shipping.**

The `version` field in `.claude-plugin/plugin.json` is what makes the update
land: the plugin cache directory is version-keyed, so an unbumped manifest
reads as already current and Claude Code skips the update. A user-visible
change that does not bump the version does not reach anyone.

Tags and GitHub releases do not affect delivery. They exist so
"what was in 0.4.0" stays answerable after `main` moves on.

## Steps

1. **Bump `version` in `.claude-plugin/plugin.json`** in the same commit that
   ships the change. Do not add a separate `chore: release` commit — the bump
   is the release, and an empty marker commit carries nothing.
   - New skill, new mode, or a changed interaction → minor (`0.4.0`).
   - Fix or a doc a user reads → patch (`0.4.1`).

   Not every commit is a release. Maintainer-facing work — this file, CI,
   tests — bumps nothing and rides along in the next release that does.
2. **Update `.claude-plugin/marketplace.json`** if the change alters what the
   plugin does. Both descriptions list the skills by name; keep them in step.
3. **Run both suites.** `npm test` and `npm run test:bats`. Both must pass.
4. **Commit and push to `main`.**
5. **Tag the commit** and push the tag:
   ```
   git tag -a v0.4.0 <sha> -m "v0.4.0 — <one-line summary>"
   git push origin v0.4.0
   ```
6. **Create the GitHub release** on that tag:
   ```
   gh release create v0.4.0 --title "v0.4.0 — <summary>" --notes "<notes>"
   ```
   Write the notes by hand. Say what changed for the user, how to get it, and
   link the compare view against the previous tag. `--generate-notes` is fine
   when a release bundles many commits.

## Notes

- Tagging started at `v0.4.0`. `0.3.0` and `0.3.1` shipped untagged, as
  `chore: release` commits. Do not backfill them.
- Commits go straight to `main`. That is this repo's history and it is
  deliberate.
- Every release tells users to restart Claude Code. Skill and hook changes
  load at session start.
