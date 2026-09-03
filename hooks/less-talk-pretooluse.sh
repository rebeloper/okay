#!/usr/bin/env bash
# Fast PreToolUse gate for less-talk's sandbox nudge: only spin up Node
# when less-talk is on. Runs on every Bash/Read/Grep call, so when the
# mode is off we must NOT pay Node's startup cost.
#
# Points at less-talk's own state path and gate script.
: "${OKAY_DIR:=$HOME/.okay}"
: "${CLAUDE_PLUGIN_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# Builtins only, no subshell and no `tr`: this runs before every single
# Bash/Read/Grep call, and the off path must cost as close to nothing as
# possible.
state=""
[ -r "$OKAY_DIR/less-talk" ] && read -r state < "$OKAY_DIR/less-talk"
[ "${state//[[:space:]]/}" = "on" ] || exit 0
# No node on PATH (the native installer doesn't provide one): stay silent.
# Without this the exec fails with 127 on EVERY Bash/Read/Grep call.
command -v node >/dev/null 2>&1 || exit 0
exec node "$CLAUDE_PLUGIN_ROOT/skills/less-talk/scripts/pretooluse.mjs"
