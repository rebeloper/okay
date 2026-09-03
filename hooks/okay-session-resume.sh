#!/usr/bin/env bash
# SessionStart hook — re-arms the two okay toggles (less-talk, less-code) in a
# fresh session by reading their state files under ~/.okay/. Ships with the
# plugin itself (wired via hooks/hooks.json).
#
# Both toggles are on-by-default: on first-ever run (state file missing
# — e.g. installed via `claude plugin install` directly rather than through
# okay-installer.sh) each seeds itself to "on" and installs the
# status-bar segment.
set -euo pipefail

: "${OKAY_DIR:=$HOME/.okay}"
: "${CLAUDE_PLUGIN_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

seed_default_on() {
  local name="$1"
  local state_file="$OKAY_DIR/$name"
  if [ ! -f "$state_file" ]; then
    mkdir -p "$OKAY_DIR"
    echo "on" > "$state_file"
    # shellcheck disable=SC1091
    ( source "$CLAUDE_PLUGIN_ROOT/scripts/statusline-install.sh" && do_install ) >/dev/null 2>&1 || true
  fi
}

seed_default_on "less-talk"
seed_default_on "less-code"

is_on() {
  [ -f "$OKAY_DIR/$1" ] && [ "$(tr -d '[:space:]' < "$OKAY_DIR/$1")" = "on" ]
}

MSG=""
append_msg() {
  if [ -z "$MSG" ]; then
    MSG="$1"
  else
    MSG="$(printf '%s\n\n%s' "$MSG" "$1")"
  fi
}

if is_on "less-talk"; then
  append_msg 'less-talk is ACTIVE (persisted from a prior session). Apply trim communication at lite level to every reply, and route large command/file output through okay-sandbox.mjs instead of dumping raw output. Do not announce it.'
fi

if is_on "less-code"; then
  append_msg 'less-code is ACTIVE (persisted from a prior session). Apply KISS, DRY, and YAGNI to all code written or reviewed this session, while never cutting security, input validation, data-loss handling, or accessibility. Do not announce it.'
fi

if [ -n "$MSG" ]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$MSG" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
  else
    # jq missing (plugin installed without okay-installer.sh's dependency
    # check): hand-escape the JSON-special characters the message can contain
    # instead of dying under set -e and silently re-arming nothing.
    esc=${MSG//\\/\\\\}
    esc=${esc//\"/\\\"}
    esc=${esc//$'\n'/\\n}
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$esc"
  fi
fi
exit 0
