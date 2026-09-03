---
name: less-talk
description: "Trim (lite) communication plus sandboxed command output. Ships on. Toggle with /okay:less-talk on|off or \"less-talk on/off\"."
argument-hint: "on | off"
disable-model-invocation: true
---

# less-talk — trim + sandbox

Two fixed behaviors, both on together:

- **Trim communication**, always at lite. See `reference-trim.md` in this
  folder for the compression rules and the safety override.
- **Sandboxed output** — keep large tool output out of context by running
  snippets in a subprocess (`scripts/okay-sandbox.mjs`) and surfacing only
  the derived result.

This mode is **on by default**. `okay`'s `SessionStart` hook
(`hooks/okay-session-resume.sh`) seeds `~/.okay/less-talk` to `on` on the
first session after install and re-arms it every session after.

## Stay on

Active every reply once on — trim style and sandbox routing apply to
everything, every turn. Off only via an explicit `/okay:less-talk off`.

Activation is silent. Never announce "less-talk on" (the no-self-reference
rule in `reference-trim.md` also covers this). No `AskUserQuestion` prompt
on activation.

## Toggle

On `/okay:less-talk on` or `/okay:less-talk off`, use the Bash tool silently
to write the state file and drive the status bar as **one command**. Invoke
`statusline-install.sh` with `bash`, not `source` (the user's login shell
may be zsh).

Resolve `<plugin-root>` from the **"Base directory for this skill:
`<path>`"** line at the top of this skill's invocation: strip the trailing
`/skills/less-talk`. Substitute that literal path — plain text, no `$VAR` or
`${VAR}` syntax (shell-expansion syntax in the submitted command opts it
out of "don't ask again" forever).

```bash
mkdir -p ~/.okay && echo "on" > ~/.okay/less-talk && \
  bash "<plugin-root>/scripts/statusline-install.sh" install   # on
```

```bash
echo "off" > ~/.okay/less-talk
# off — state file only. The status-bar script is never uninstalled here,
# so less-code's 💎 segment, if on, keeps rendering. The 📈 segment stops
# on the next render because the script reads this state file live.
```

**Check the exit code before confirming.** Give the one-line confirmation —
"Less talk on." or "Less talk off." — only if the command exited 0. On a
non-zero exit, show the error output and stop.

## Persistence

The `SessionStart` hook re-arms this mode every new session by reading
`~/.okay/less-talk`.

## Sandbox execution

**When to use** — about to `cat`/`Read`/`grep` a large file or dump long
command output; parsing a big JSON or log when you need only a few values.

**How to call it** — resolve `<plugin-root>` as above, then invoke the
script with `node`. Code goes on **stdin** (heredoc), never as an argument:

```
node "<plugin-root>/skills/less-talk/scripts/okay-sandbox.mjs" --lang shell <<'EOF'
grep -c ERROR huge.log
EOF
```

`--lang` accepts `shell`, `js`, `python`, `ruby`, `perl` (whichever is
installed). `--timeout <seconds>` overrides the 30s default. Output is
capped at 50 KB; on overflow it is truncated with a note (narrow the
snippet with grep/head/count).

**Not a security sandbox.** Snippets run with your full user privileges,
exactly like Bash. This isolates **context**, not **trust**.

A `PreToolUse` hook shipped with the plugin enforces this whenever
`less-talk` is on: a `Bash` command that provably references a large file
is **denied** with a message pointing at this script; one over a provably
small file runs untouched; unknown output size, a large `Read`, or an
unbounded `Grep` (`output_mode: content` with no `head_limit`) gets a
softer nudge. The message already carries the resolved absolute path. The
hook exits silently when `node` is not on the PATH.

## Status bar

While `less-talk` is on, the status bar shows `📈<usage>`: the bare
token-usage count, color-coded green/orange/red by thresholds, plus
`·♻️~<saved>` in green once the sandbox has kept a positive number of
tokens out of the context window this session. Nothing shows while
`less-talk` is off.
