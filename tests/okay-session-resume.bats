#!/usr/bin/env bats

setup() {
  SCRIPT="$BATS_TEST_DIRNAME/../hooks/okay-session-resume.sh"
  HOOKS_JSON="$BATS_TEST_DIRNAME/../hooks/hooks.json"
  CLAUDE_PLUGIN_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  OKAY_DIR="$BATS_TEST_TMPDIR/okay"
  CLAUDE_DIR="$BATS_TEST_TMPDIR/claude"
  mkdir -p "$OKAY_DIR" "$CLAUDE_DIR"
}

run_hook() {
  env OKAY_DIR="$OKAY_DIR" CLAUDE_DIR="$CLAUDE_DIR" \
    CLAUDE_PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT" bash "$SCRIPT"
}

@test "prints nothing and exits 0 when both toggles are off" {
  echo off > "$OKAY_DIR/less-talk"
  echo off > "$OKAY_DIR/less-code"
  run run_hook
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "seeds both toggles to on and emits SessionStart context on first-ever run" {
  run run_hook
  [ "$status" -eq 0 ]
  [ "$(tr -d '[:space:]' < "$OKAY_DIR/less-talk")" = "on" ]
  [ "$(tr -d '[:space:]' < "$OKAY_DIR/less-code")" = "on" ]
  [[ "$output" == *"SessionStart"* ]]
}

@test "installs the status-bar segment on first-ever run" {
  run_hook
  [ -f "$CLAUDE_DIR/hooks/statusline.sh" ]
  run bash -c "printf '{}' | env OKAY_DIR='$OKAY_DIR' bash '$CLAUDE_DIR/hooks/statusline.sh'"
  [[ "$output" == *"💎"* ]]
}

@test "does not reseed or reinstall on a second run once state files exist" {
  echo off > "$OKAY_DIR/less-talk"
  echo off > "$OKAY_DIR/less-code"
  run run_hook
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  [ "$(tr -d '[:space:]' < "$OKAY_DIR/less-talk")" = "off" ]
  [ "$(tr -d '[:space:]' < "$OKAY_DIR/less-code")" = "off" ]
  [ ! -f "$CLAUDE_DIR/hooks/statusline.sh" ]
}

# Regression: install used to fire only when a state file was missing, so a
# first session without jq seeded the toggles, failed the install silently,
# and never retried. The retry is keyed on the marker, not on first run.
@test "installs the status bar on a later session when it is missing" {
  echo on > "$OKAY_DIR/less-talk"
  echo on > "$OKAY_DIR/less-code"
  [ ! -f "$CLAUDE_DIR/hooks/statusline.sh" ]
  run run_hook
  [ "$status" -eq 0 ]
  [ -f "$CLAUDE_DIR/hooks/statusline.sh" ]
}

@test "does not reinstall the status bar once it carries the marker" {
  echo on > "$OKAY_DIR/less-talk"
  echo off > "$OKAY_DIR/less-code"
  mkdir -p "$CLAUDE_DIR/hooks"
  printf '#!/usr/bin/env bash\n# okay-statusline: fresh\nprintf mine\n' > "$CLAUDE_DIR/hooks/statusline.sh"
  run run_hook
  [ "$status" -eq 0 ]
  [ "$(cat "$CLAUDE_DIR/hooks/statusline.sh" | tail -1)" = "printf mine" ]
}

# An explicit uninstall is a choice. The hook must not undo it every session.
@test "honors the statusline opt-out and does not reinstall" {
  echo on > "$OKAY_DIR/less-talk"
  echo on > "$OKAY_DIR/less-code"
  : > "$OKAY_DIR/statusline-optout"
  run run_hook
  [ "$status" -eq 0 ]
  [ ! -f "$CLAUDE_DIR/hooks/statusline.sh" ]
}

@test "prunes stats and measured files older than a week" {
  echo off > "$OKAY_DIR/less-talk"
  echo off > "$OKAY_DIR/less-code"
  mkdir -p "$OKAY_DIR/less-talk-stats" "$OKAY_DIR/less-talk-measured"
  touch -t 202001010000 "$OKAY_DIR/less-talk-stats/old-session"
  touch "$OKAY_DIR/less-talk-measured/current-session"
  run run_hook
  [ "$status" -eq 0 ]
  [ ! -f "$OKAY_DIR/less-talk-stats/old-session" ]
  [ -f "$OKAY_DIR/less-talk-measured/current-session" ]
}

# An unwritable state dir must degrade the hook to a silent no-op, never abort
# it under `set -e` on every single session.
@test "exits 0 quietly when the state directory cannot be written" {
  run env OKAY_DIR="/dev/null/nope" CLAUDE_DIR="$CLAUDE_DIR" \
    CLAUDE_PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "tolerates whitespace padding around the value" {
  printf ' on \n' > "$OKAY_DIR/less-talk"
  echo off > "$OKAY_DIR/less-code"
  run run_hook
  [ "$status" -eq 0 ]
  [[ "$output" == *"SessionStart"* ]]
}

@test "emits the less-talk reminder when only less-talk is on" {
  echo on > "$OKAY_DIR/less-talk"
  echo off > "$OKAY_DIR/less-code"
  run run_hook
  [ "$status" -eq 0 ]
  ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<<"$output")"
  [[ "$ctx" == *"less-talk is ACTIVE"* ]]
  [[ "$ctx" == *"okay-sandbox.mjs"* ]]
  [[ "$ctx" != *"less-code is ACTIVE"* ]]
}

@test "emits the less-code reminder when only less-code is on" {
  echo off > "$OKAY_DIR/less-talk"
  echo on > "$OKAY_DIR/less-code"
  run run_hook
  [ "$status" -eq 0 ]
  ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<<"$output")"
  [[ "$ctx" == *"less-code is ACTIVE"* ]]
  [[ "$ctx" == *"KISS, DRY, and YAGNI"* ]]
  [[ "$ctx" != *"less-talk is ACTIVE"* ]]
}

@test "concatenates both reminders when both toggles are on" {
  echo on > "$OKAY_DIR/less-talk"
  echo on > "$OKAY_DIR/less-code"
  run run_hook
  [ "$status" -eq 0 ]
  ctx="$(jq -r '.hookSpecificOutput.additionalContext' <<<"$output")"
  [[ "$ctx" == *"less-talk is ACTIVE"* ]]
  [[ "$ctx" == *"less-code is ACTIVE"* ]]
  # less-talk is emitted first, per the spec's order.
  [[ "${ctx%%less-code is ACTIVE*}" == *"less-talk is ACTIVE"* ]]
}

@test "jq-missing fallback still emits valid JSON and exits 0" {
  echo on > "$OKAY_DIR/less-talk"
  echo on > "$OKAY_DIR/less-code"
  stub="$BATS_TEST_TMPDIR/stubbin"
  mkdir -p "$stub"
  for c in bash mkdir tr cat dirname sed; do
    src="$(command -v "$c")" && ln -sf "$src" "$stub/$c"
  done
  run env PATH="$stub" OKAY_DIR="$OKAY_DIR" \
    CLAUDE_PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  # jq is back on this shell's PATH — use it to prove the hand-escaped output parses.
  run jq -e '.hookSpecificOutput.hookEventName == "SessionStart"' <<<"$output"
  [ "$status" -eq 0 ]
}

@test "hooks.json wires the resume script under SessionStart" {
  run jq -e '.hooks.SessionStart[0].hooks[0].command | contains("okay-session-resume.sh")' "$HOOKS_JSON"
  [ "$status" -eq 0 ]
}
