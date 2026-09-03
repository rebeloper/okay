---
name: less-code
description: "KISS/DRY/YAGNI code discipline for every line written or reviewed. Ships on. Toggle with /okay:less-code on|off or \"less-code on/off\". Bare mentions of KISS, DRY, or YAGNI are not a toggle."
argument-hint: "on | off"
disable-model-invocation: true
---

# less-code — KISS/DRY/YAGNI discipline

One fixed behavior: apply KISS, DRY, and YAGNI to all code written or
reviewed. See `reference-kiss.md` in this folder for the decision ladder,
the three principles, and the non-negotiable guardrails (security,
trust-boundary validation, data-loss handling, accessibility) — these stay
in full even while everything else is simplified.

This mode is **on by default**. `okay`'s `SessionStart` hook
(`hooks/okay-session-resume.sh`) seeds `~/.okay/less-code` to `on` on the
first session after install and re-arms it every session after.

## Stay on

Active every reply once on — applies to all code written or reviewed, every
turn. No drift, no revert until an explicit `/okay:less-code off`.

Activation is silent. Never announce "less-code on". No `AskUserQuestion`
prompt on activation — there is no level to pick.

## Toggle

On `/okay:less-code on` or `/okay:less-code off`, use the Bash tool silently
to write the state file and drive the status bar as **one command**, so the
exit code covers both steps.

Resolve `<plugin-root>` from the **"Base directory for this skill:
`<path>`"** line printed at the top of this skill's invocation: strip the
trailing `/skills/less-code`. Substitute that literal path into the command
below — plain text, no `$VAR` or `${VAR}` syntax (any shell-expansion
syntax in the submitted command opts it out of "don't ask again" forever).

```bash
mkdir -p ~/.okay && echo "on" > ~/.okay/less-code && \
  bash "<plugin-root>/scripts/statusline-install.sh" install   # on
```

```bash
echo "off" > ~/.okay/less-code
# off — state file only. The shared status-bar script is never uninstalled
# here, so less-talk's 📈 segment, if on, keeps rendering.
```

**Check the exit code before confirming.** Give the one-line confirmation —
"Less code on." or "Less code off." — only if the command exited 0. On a
non-zero exit, show the error output and stop.

## Persistence

The `SessionStart` hook re-arms this mode every new session by reading
`~/.okay/less-code`. No re-toggling across sessions.

## Status bar

While `less-code` is on, the status bar shows a bare `💎` — an on-indicator
only, no stats.
