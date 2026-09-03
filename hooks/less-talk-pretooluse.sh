#!/usr/bin/env bash
# Fast PreToolUse gate for less-talk's sandbox nudge: only spin up Node
# when less-talk is on. Runs on every Bash/Read/Grep call, so when the
# mode is off we must NOT pay Node's startup cost.
#
# Points at less-talk's own state path and gate script.
: "${OKAY_DIR:=$HOME/.okay}"
: "${CLAUDE_PLUGIN_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
[ "$(cat "$OKAY_DIR/less-talk" 2>/dev/null | tr -d '[:space:]')" = "on" ] || exit 0
exec node "$CLAUDE_PLUGIN_ROOT/skills/less-talk/scripts/pretooluse.mjs"
