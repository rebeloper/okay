#!/usr/bin/env bash
# SessionStart hook — re-arms the two okay toggles (less-talk, less-code) in a
# fresh session by reading their state files under ~/.okay/. Ships with the
# plugin itself (wired via hooks/hooks.json).
#
# Both toggles are on-by-default: on first-ever run (state file missing)
# each seeds itself to "on".
set -euo pipefail

: "${OKAY_DIR:=$HOME/.okay}"
: "${CLAUDE_DIR:=$HOME/.claude}"
: "${CLAUDE_PLUGIN_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

STATUSLINE="$CLAUDE_DIR/hooks/statusline.sh"
OPTOUT="$OKAY_DIR/statusline-optout"

# Every write below is best-effort: an unwritable HOME must degrade this hook
# to a silent no-op, not abort it under `set -e` on every single session.
mkdir -p "$OKAY_DIR" 2>/dev/null || true

seed_default_on() {
  local state_file="$OKAY_DIR/$1"
  # The redirect wraps the whole group: bash reports a failed `>` on the
  # stderr in force when it opens the file, so `echo ... > f 2>/dev/null`
  # would still print "Not a directory" on an unwritable HOME.
  { [ -f "$state_file" ] || echo "on" > "$state_file"; } 2>/dev/null || true
}

seed_default_on "less-talk"
seed_default_on "less-code"

is_on() {
  [ -f "$OKAY_DIR/$1" ] && [ "$(tr -d '[:space:]' < "$OKAY_DIR/$1")" = "on" ]
}

# Install the status bar whenever a toggle is on and the bar is not already
# ours. Retried every session rather than only on first run: a first session
# without jq would otherwise seed the state files, fail the install silently,
# and never try again. do_install is idempotent, so a no-op costs one grep.
# $OPTOUT (written by do_uninstall) is how a user keeps the bar off while
# keeping the plugin — never reinstall over that.
# do_install exits 0 in two cases where the bar will never render: it refuses a
# stale statusline.sh.pre-okay backup, and settings.json already runs a
# different statusLine. Both print a line starting ⚠. Swallowing those left the
# user with a mode that says it is on and a bar that never appears, forever —
# so the warning goes into STATUS_WARN and out through the session message.
STATUS_WARN=""
ensure_status_bar() {
  [ -f "$OPTOUT" ] && return 0
  grep -qF "okay-statusline" "$STATUSLINE" 2>/dev/null && return 0
  local out line
  # shellcheck disable=SC1091
  out=$( ( source "$CLAUDE_PLUGIN_ROOT/scripts/statusline-install.sh" && do_install ) 2>&1 || true )
  # Builtins only. A `grep` here wrote "command not found" to stderr on the
  # PATH-stripped path, and a SessionStart hook's stderr is not free: it lands
  # in the transcript next to the JSON this hook exists to print.
  while IFS= read -r line; do
    case "$line" in ⚠*) STATUS_WARN="$line" ;; esac
  done <<< "$out"
}

# Report a warning once per distinct text. The stale-backup branch leaves the
# bar uninstalled, so ensure_status_bar retries it every single session —
# without this the same paragraph would be re-injected forever.
warn_is_new() {
  local seen="$OKAY_DIR/statusline-warning"
  [ "$(cat "$seen" 2>/dev/null)" = "$1" ] && return 1
  printf '%s' "$1" > "$seen" 2>/dev/null || true
  return 0
}

if is_on "less-talk" || is_on "less-code"; then
  ensure_status_bar
fi

# The sandbox writes one stats and one measured file per session and nothing
# ever removes them. Drop the stale ones so ~/.okay/ stays bounded.
find "$OKAY_DIR/less-talk-stats" "$OKAY_DIR/less-talk-measured" \
  -type f -mtime +7 -delete 2>/dev/null || true

MSG=""
append_msg() {
  if [ -z "$MSG" ]; then
    MSG="$1"
  else
    MSG="$(printf '%s\n\n%s' "$MSG" "$1")"
  fi
}

# Each mode's full rules live in a reference file next to its skill. The skill
# itself only loads on an explicit `/okay:<mode> on|off`, which is a state
# write, not a "read your rules" moment — so the always-on path has to name the
# reference here or the rules never reach the model at all.
if is_on "less-talk"; then
  append_msg "less-talk is ACTIVE. Apply trim communication at lite level to every reply, and route large command/file output through okay-sandbox.mjs instead of dumping raw output. Do not announce it. Read $CLAUDE_PLUGIN_ROOT/skills/less-talk/reference-trim.md once before your first reply: it carries the compression rules, the no-em-dash rule, the safety override that drops the mode for destructive and security-critical output, and the rule that a skill defining its own voice wins inside that skill."
fi

if is_on "less-code"; then
  append_msg "less-code is ACTIVE. Apply KISS, DRY, and YAGNI to all code written or reviewed this session, while never cutting security, input validation, data-loss handling, or accessibility. Do not announce it. Read $CLAUDE_PLUGIN_ROOT/skills/less-code/reference-kiss.md once before you write or review code: it carries the decision ladder and the full guardrail list."
fi

if [ -n "$STATUS_WARN" ] && warn_is_new "$STATUS_WARN"; then
  append_msg "okay's status bar could not be installed. Tell the user this, verbatim, once: $STATUS_WARN"
fi

if [ -n "$MSG" ]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$MSG" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
  else
    # jq missing from the user's PATH: hand-escape the JSON-special
    # characters the message can contain instead of dying under set -e and
    # silently re-arming nothing.
    esc=${MSG//\\/\\\\}
    esc=${esc//\"/\\\"}
    esc=${esc//$'\n'/\\n}
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$esc"
  fi
fi
exit 0
