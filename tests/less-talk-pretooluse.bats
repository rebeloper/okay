#!/usr/bin/env bats

setup() {
  SCRIPT="$BATS_TEST_DIRNAME/../hooks/less-talk-pretooluse.sh"
  HOOKS_JSON="$BATS_TEST_DIRNAME/../hooks/hooks.json"
  CLAUDE_PLUGIN_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  OKAY_DIR="$BATS_TEST_TMPDIR/okay"
  mkdir -p "$OKAY_DIR"
}

run_shim() {
  printf '%s' "$1" | env OKAY_DIR="$OKAY_DIR" CLAUDE_PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT" bash "$SCRIPT"
}

@test "exits 0 immediately with no output when less-talk is off" {
  echo off > "$OKAY_DIR/less-talk"
  run run_shim '{"tool_name":"Bash","tool_input":{"command":"cat huge.log"}}'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "exits 0 immediately when the state file is missing" {
  run run_shim '{"tool_name":"Bash","tool_input":{"command":"cat huge.log"}}'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# Regression: `exec node` used to fail with 127 and a stderr line on EVERY
# Bash/Read/Grep call for anyone without node on their PATH.
@test "exits 0 quietly when node is not on the PATH" {
  echo on > "$OKAY_DIR/less-talk"
  # An empty PATH is the point: it must find neither node nor `tr`, so the
  # state read has to be builtin-only for this to reach the node guard.
  mkdir -p "$BATS_TEST_TMPDIR/empty-bin"
  run env -i PATH="$BATS_TEST_TMPDIR/empty-bin" OKAY_DIR="$OKAY_DIR" \
    CLAUDE_PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT" "$(command -v bash)" "$SCRIPT" \
    <<< '{"tool_name":"Bash","tool_input":{"command":"cat huge.log"}}'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "denies a dump-prone Bash command over a provably large file when on" {
  echo on > "$OKAY_DIR/less-talk"
  big_file="$BATS_TEST_TMPDIR/huge.log"
  head -c 60000 /dev/zero > "$big_file"
  run run_shim "$(printf '{"tool_name":"Bash","tool_input":{"command":"cat %s"}}' "$big_file")"
  # Hook protocol: decision JSON on stdout, exit 0 — the deny lives in the JSON.
  [ "$status" -eq 0 ]
  [[ "$output" == *'"permissionDecision":"deny"'* ]]
  [[ "$output" == *"$CLAUDE_PLUGIN_ROOT/skills/less-talk/scripts/okay-sandbox.mjs"* ]]
}

@test "leaves a dump-prone Bash command over a provably small file alone" {
  echo on > "$OKAY_DIR/less-talk"
  small_file="$BATS_TEST_TMPDIR/state"
  echo on > "$small_file"
  run run_shim "$(printf '{"tool_name":"Bash","tool_input":{"command":"cat %s"}}' "$small_file")"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "soft-nudges a dump-prone Bash command of unknown output size" {
  echo on > "$OKAY_DIR/less-talk"
  run run_shim '{"tool_name":"Bash","tool_input":{"command":"cat no-such-file.log"}}'
  [ "$status" -eq 0 ]
  [[ "$output" == *"additionalContext"* ]]
  [[ "$output" != *'"permissionDecision":"deny"'* ]]
}

@test "leaves a non-dump Bash command alone when on" {
  echo on > "$OKAY_DIR/less-talk"
  run run_shim '{"tool_name":"Bash","tool_input":{"command":"git status"}}'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "soft-nudges a large Read with additionalContext, exit 0" {
  echo on > "$OKAY_DIR/less-talk"
  big_file="$BATS_TEST_TMPDIR/huge.log"
  head -c 60000 /dev/zero > "$big_file"
  run run_shim "$(printf '{"tool_name":"Read","tool_input":{"file_path":"%s"}}' "$big_file")"
  [ "$status" -eq 0 ]
  [[ "$output" == *"additionalContext"* ]]
  [[ "$output" == *"okay-sandbox.mjs"* ]]
}

@test "hooks.json wires less-talk-pretooluse.sh under PreToolUse" {
  run jq -e '.hooks.PreToolUse[0].hooks[0].command | contains("less-talk-pretooluse.sh")' "$HOOKS_JSON"
  [ "$status" -eq 0 ]
}
