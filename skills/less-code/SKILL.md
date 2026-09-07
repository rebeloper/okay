---
name: less-code
description: "KISS/DRY/YAGNI code discipline for every line written or reviewed. Ships on. Toggle with /okay:less-code on|off. Slash-command only: this skill is never model-invoked, so bare words in chat do not toggle it."
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
(`hooks/okay-session-resume.sh`, relative to the plugin root) seeds `~/.okay/less-code` to `on` on the
first session after install and re-arms it every session after.

## Stay on

Active every reply once on — applies to all code written or reviewed, every
turn. No drift, no revert until an explicit `/okay:less-code off`.

Activation is silent. Never announce "less-code on". No `AskUserQuestion`
prompt on activation — there is no level to pick.

## Toggle

On `/okay:less-code on` or `/okay:less-code off`, use the Bash tool silently
to write the state file and drive the status bar. Invoke
`statusline-install.sh` with `bash`, not `source` (the user's login shell
may be zsh). With no argument, or any argument other than `on` or `off`,
change nothing: report the current mode by reading `~/.okay/less-code`, and
say the accepted arguments.

Resolve `<plugin-root>` from the **"Base directory for this skill:
`<path>`"** line at the top of this skill's invocation: strip the trailing
`/skills/less-code`. Substitute that literal path — plain text, no `$VAR` or
`${VAR}` syntax (shell-expansion syntax in the submitted command opts it
out of "don't ask again" forever). If that line is absent, do not submit a
command with the literal `<plugin-root>` in it. Write the state file on its
own, then say the status bar could not be reached and name why.

```bash
mkdir -p ~/.okay && echo "on" > ~/.okay/less-code && \
  bash "<plugin-root>/scripts/statusline-install.sh" install   # on
```

```bash
mkdir -p ~/.okay && echo "off" > ~/.okay/less-code
# off — state file only. The shared status-bar script is never uninstalled
# here, so `less-talk`'s 📈 segment, if on, keeps rendering. The 💎 segment
# stops on the next render because the script reads this state file live.
# `mkdir -p` matters as much here as on the on path: without it, `off` fails
# whenever ~/.okay is missing, and the SessionStart hook re-seeds this mode
# to "on" next session — so turning it off would never stick.
```

**Read the output, not only the exit code.** The two halves fail
independently, so neither one's status speaks for the other.

- The state file is written first and by itself. If that `echo` fails, the
  mode did not change: show the error and stop.
- `statusline-install.sh` exits non-zero when `jq` is missing, *after* the
  state file is already written. The mode did change anyway. Confirm the
  new mode, then say the status bar needs `jq`.
- The script also exits 0 in two cases where the bar will not render: it
  refuses a stale `statusline.sh.pre-okay` backup, and it warns when
  `settings.json` already runs a different `statusLine`. Both print a line
  starting `⚠`. On a `⚠`, confirm the new mode and repeat the warning
  verbatim. Never report a bare success over it.
- Otherwise give the one-line confirmation: "Less code on." or "Less code off."

## Persistence

The `SessionStart` hook re-arms this mode every new session by reading
`~/.okay/less-code`. No re-toggling across sessions.

## Status bar

While `less-code` is on, the status bar shows a bare `💎` — an on-indicator
only, no stats.
