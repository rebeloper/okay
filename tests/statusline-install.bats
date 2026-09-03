#!/usr/bin/env bats

setup() {
  SCRIPT="$BATS_TEST_DIRNAME/../scripts/statusline-install.sh"
  CLAUDE_DIR="$BATS_TEST_TMPDIR/claude"
  OKAY_DIR="$BATS_TEST_TMPDIR/okay"
  mkdir -p "$CLAUDE_DIR" "$OKAY_DIR"
  source "$SCRIPT"
}

render() {
  printf '%s' "$1" | env -u CLAUDE_CODE_SESSION_ID OKAY_DIR="$OKAY_DIR" bash "$STATUSLINE"
}

@test "install creates a fresh statusline.sh and registers statusLine when none exists" {
  run do_install
  [ "$status" -eq 0 ]
  [ -f "$STATUSLINE" ]
  [[ "$(jq -r '.statusLine.command' "$SETTINGS")" == *"$STATUSLINE"* ]]
}

@test "fresh bar prints nothing when both toggles are off or absent" {
  do_install >/dev/null
  run render '{}'
  [ -z "$output" ]
}

@test "install wraps an existing foreign statusline.sh instead of replacing it" {
  mkdir -p "$HOOKS_DIR"
  printf '#!/usr/bin/env bash\nprintf FOREIGN\nexit 0\n' > "$STATUSLINE"
  chmod +x "$STATUSLINE"
  run do_install
  [ "$status" -eq 0 ]
  [ -f "$BACKUP" ]
  [[ "$(cat "$BACKUP")" == *"FOREIGN"* ]]
  run render '{}'
  [[ "$output" == *"FOREIGN"* ]]
}

@test "wrapped bar concatenates the original output with the less-code gem" {
  mkdir -p "$HOOKS_DIR"
  printf '#!/usr/bin/env bash\nprintf FOREIGN\nexit 0\n' > "$STATUSLINE"
  chmod +x "$STATUSLINE"
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-code"
  run render '{}'
  [ "$output" = "FOREIGN💎" ]
}

@test "install does not touch settings.json when wrapping an existing statusline.sh" {
  mkdir -p "$HOOKS_DIR"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$STATUSLINE"
  chmod +x "$STATUSLINE"
  echo '{"statusLine":{"type":"command","command":"bash something-else.sh"}}' > "$SETTINGS"
  run do_install
  [ "$status" -eq 0 ]
  [ "$(jq -r '.statusLine.command' "$SETTINGS")" = "bash something-else.sh" ]
}

@test "install warns when settings.json registers a different statusLine command" {
  echo '{"statusLine":{"type":"command","command":"bash something-else.sh"}}' > "$SETTINGS"
  run do_install
  [ "$status" -eq 0 ]
  [[ "$output" == *"will NOT render"* ]]
  [ "$(jq -r '.statusLine.command' "$SETTINGS")" = "bash something-else.sh" ]
}

@test "install registers statusLine even when the fresh script already exists (repair)" {
  do_install >/dev/null
  rm -f "$SETTINGS"
  run do_install
  [ "$status" -eq 0 ]
  [[ "$(jq -r '.statusLine.command' "$SETTINGS")" == *"$STATUSLINE"* ]]
}

@test "wrap honors a non-bash original statusline via its shebang" {
  mkdir -p "$HOOKS_DIR"
  printf '#!/bin/sh\nprintf SHELLFREE\nexit 0\n' > "$STATUSLINE"
  chmod +x "$STATUSLINE"
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-code"
  run render '{}'
  [ "$output" = "SHELLFREE💎" ]
}

@test "install is idempotent — running twice refreshes the segment without double-wrapping" {
  mkdir -p "$HOOKS_DIR"
  printf '#!/usr/bin/env bash\nprintf FOREIGN\nexit 0\n' > "$STATUSLINE"
  chmod +x "$STATUSLINE"
  do_install >/dev/null
  run do_install
  [ "$status" -eq 0 ]
  [[ "$output" == *"refreshed"* ]]
  [[ "$(cat "$BACKUP")" == *"FOREIGN"* ]]
  [[ "$(cat "$BACKUP")" != *"okay-statusline"* ]]
}

@test "install refreshes an already-installed segment so upstream fixes reach existing installs" {
  mkdir -p "$HOOKS_DIR"
  printf '#!/usr/bin/env bash\nprintf FOREIGN\nexit 0\n' > "$STATUSLINE"
  chmod +x "$STATUSLINE"
  do_install >/dev/null
  # Simulate a stale install by corrupting the segment logic already in place.
  sed -i.bak 's/less-code/less-code-STALE-MARKER/' "$STATUSLINE"
  rm -f "$STATUSLINE.bak"
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-code"
  run render '{}'
  [ "$output" = "FOREIGN💎" ]
}

@test "uninstall restores the original statusline.sh after a wrap" {
  mkdir -p "$HOOKS_DIR"
  printf '#!/usr/bin/env bash\nprintf FOREIGN\nexit 0\n' > "$STATUSLINE"
  chmod +x "$STATUSLINE"
  do_install >/dev/null
  run do_uninstall
  [ "$status" -eq 0 ]
  [ ! -f "$BACKUP" ]
  [[ "$(cat "$STATUSLINE")" == *"FOREIGN"* ]]
  [[ "$(cat "$STATUSLINE")" != *"okay-statusline"* ]]
}

@test "uninstall removes a fresh statusline.sh and unregisters statusLine" {
  do_install >/dev/null
  run do_uninstall
  [ "$status" -eq 0 ]
  [ ! -f "$STATUSLINE" ]
  [ "$(jq -r 'has("statusLine")' "$SETTINGS")" = "false" ]
}

@test "uninstall is a no-op when nothing is installed" {
  run do_uninstall
  [ "$status" -eq 0 ]
}

@test "less-talk segment shows bare usage under 1000" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  run render '{"context_window":{"total_input_tokens":42}}'
  [[ "$output" == *"📈"* ]]
  [[ "$output" == *"42"* ]]
}

@test "less-talk segment shows K-suffixed usage at or above 1000" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  run render '{"context_window":{"total_input_tokens":45000}}'
  [[ "$output" == *"45.0K"* ]]
}

@test "less-talk usage renders red above the 200000 threshold" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  run render '{"context_window":{"total_input_tokens":210000}}'
  [[ "$output" == *"174;32;18"* ]]
}

@test "less-talk segment is absent when usage is zero" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  run render '{"context_window":{"total_input_tokens":0}}'
  [[ "$output" != *"📈"* ]]
}

@test "less-talk savings segment appears once positive savings exist" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  stats_dir="$OKAY_DIR/less-talk-stats"
  mkdir -p "$stats_dir"
  printf 'in 4000\nout 0\n' > "$stats_dir/default"
  run render '{"context_window":{"total_input_tokens":1000}}'
  [[ "$output" == *"♻️"* ]]
  [[ "$output" == *"1.0K"* ]]
}

@test "less-talk savings segment uses the session_id from the render input" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  stats_dir="$OKAY_DIR/less-talk-stats"
  mkdir -p "$stats_dir"
  printf 'in 4000\nout 0\n' > "$stats_dir/abc-123"
  run render '{"session_id":"abc-123","context_window":{"total_input_tokens":1000}}'
  [[ "$output" == *"♻️"* ]]
}

@test "less-talk savings segment is skipped when saved is under 1" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  stats_dir="$OKAY_DIR/less-talk-stats"
  mkdir -p "$stats_dir"
  printf 'in 2\nout 0\n' > "$stats_dir/default"
  run render '{"context_window":{"total_input_tokens":1000}}'
  [[ "$output" != *"♻️"* ]]
}

@test "less-code segment shows a bare icon with no stats" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-code"
  run render '{}'
  [[ "$output" == *"💎"* ]]
}

@test "segment order stays fixed (💎 then 📈) regardless of toggle order" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  echo on > "$OKAY_DIR/less-code"
  run render '{"context_window":{"total_input_tokens":500}}'
  [[ "$output" == "💎·📈"* ]]
}

@test "active segments are joined with a middle dot separator" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-code"
  echo on > "$OKAY_DIR/less-talk"
  run render '{"context_window":{"total_input_tokens":500}}'
  [[ "$output" == "💎·📈"* ]]
}

@test "less-talk segment appends used_percentage in parentheses when present" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  run render '{"context_window":{"total_input_tokens":48500,"used_percentage":12.8}}'
  [[ "$output" == *"48.5K(12.8%)"* ]]
}

@test "savings segment is joined to the usage segment with a middle dot, not a space" {
  do_install >/dev/null
  echo on > "$OKAY_DIR/less-talk"
  stats_dir="$OKAY_DIR/less-talk-stats"
  mkdir -p "$stats_dir"
  printf 'in 4000\nout 0\n' > "$stats_dir/default"
  run render '{"context_window":{"total_input_tokens":1000}}'
  [[ "$output" == *"·♻️"* ]]
  [[ "$output" != *" ♻️"* ]]
}
