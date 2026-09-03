#!/usr/bin/env bash
# statusline-install — shared status-bar install/uninstall logic for the
# two okay toggles (less-code, less-talk).
# Called from each toggle skill's "on" instructions and from the
# SessionStart hook's first-run seeding — do_install is idempotent, so it's
# safe to call from whichever toggle activates first. The installed script
# itself reads both state files on every render and concatenates whichever
# segments are active, so a single toggle going "off" only needs to write
# its own state file — never do_uninstall, which would take the other
# toggle's segments down with it. do_uninstall is reserved for the
# uninstall subcommand.
set -euo pipefail

: "${CLAUDE_DIR:=$HOME/.claude}"
: "${OKAY_DIR:=$HOME/.okay}"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"
STATUSLINE="$HOOKS_DIR/statusline.sh"
BACKUP="$STATUSLINE.pre-okay"
MARKER="okay-statusline"
OPTOUT="$OKAY_DIR/statusline-optout"

command -v jq >/dev/null 2>&1 || { echo "✗ jq is required but not found" >&2; exit 1; }

installed_fresh() { [ -f "$STATUSLINE" ] && grep -qF "$MARKER: fresh" "$STATUSLINE" 2>/dev/null; }
# Both halves must hold. Testing only for $BACKUP would let a stale backup
# (statusline.sh replaced by hand, or by another tool, while the backup
# survived) drive render_wrapped, silently overwriting the user's own script
# with a wrapper around a script they already moved on from.
installed_wrapped() { [ -f "$BACKUP" ] && [ -f "$STATUSLINE" ] && grep -qF "$MARKER: wrapped" "$STATUSLINE" 2>/dev/null; }
# A backup with no okay-owned statusline.sh in front of it. Never write in
# this state — we cannot tell the user's current script from ours.
stale_backup() { [ -f "$BACKUP" ] && ! installed_wrapped; }

# Embedded verbatim into both the "fresh" and "wrapped" variants below, so
# the segment logic lives in exactly one place. Read with a quoted heredoc
# delimiter ('FN') so $ signs are stored literally, not expanded now — they
# run at statusline.sh RENDER time, reading whichever state/stats files
# exist at that moment.
read -r -d '' SEGMENTS_FN <<'FN' || true
render_okay_segments() {
  local okay_dir="${OKAY_DIR:-$HOME/.okay}"
  local out=""

  # Builtins only — the bar re-renders constantly, so reading a toggle must
  # not fork two processes each time.
  okay_toggle_on() {
    local v=""
    [ -r "$okay_dir/$1" ] && read -r v < "$okay_dir/$1"
    [ "${v//[[:space:]]/}" = "on" ]
  }

  if okay_toggle_on less-code; then
    out="💎"
  fi

  if okay_toggle_on less-talk; then
    local used pct usage usage_rgb seg
    used=$(printf '%s' "$INPUT" | jq -r '.context_window.total_input_tokens // empty' 2>/dev/null)
    pct=$(printf '%s' "$INPUT" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)
    if [ -n "$used" ] && [ "$used" -gt 0 ]; then
      if [ "$used" -ge 1000 ]; then usage=$(awk "BEGIN { printf \"%.1fK\", $used/1000 }"); else usage="$used"; fi
      [ -n "$pct" ] && usage=$(awk "BEGIN { printf \"%s(%.1f%%)\", \"$usage\", $pct }")
      if [ "$used" -ge 200000 ]; then usage_rgb="174;32;18"
      elif [ "$used" -ge 100000 ]; then usage_rgb="238;155;0"
      else usage_rgb="233;216;166"; fi
      seg=$(printf '📈\033[38;2;%sm%s\033[0m' "$usage_rgb" "$usage")

      # The statusline process doesn't inherit CLAUDE_CODE_SESSION_ID, so the
      # session id must come from the render-input JSON; env is a fallback.
      local sid
      sid=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
      [ -n "$sid" ] || sid="${CLAUDE_CODE_SESSION_ID:-default}"
      local stats="$okay_dir/less-talk-stats/$sid"
      if [ -s "$stats" ]; then
        local saved
        saved=$(awk '
          $1=="in"  { inb+=$2 }
          $1=="out" { outb+=$2 }
          END {
            s = (inb - outb) / 4
            if (s < 1) exit 0
            if (s >= 1000000)     printf "%.1fM", s/1000000
            else if (s >= 10000)  printf "%dK", int(s/1000+0.5)
            else if (s >= 1000)   printf "%.1fK", s/1000
            else                  printf "%d", int(s+0.5)
          }
        ' "$stats")
        [ -n "$saved" ] && seg="${seg}·$(printf '♻️\033[38;2;82;183;136m~%s\033[0m' "$saved")"
      fi
      [ -n "$out" ] && out="${out}·"
      out="${out}${seg}"
    fi
  fi

  printf '%s' "$out"
}
FN

write_fresh() {
  mkdir -p "$HOOKS_DIR"
  cat > "$STATUSLINE" <<INNER
#!/usr/bin/env bash
# $MARKER: fresh (no prior statusline.sh existed)
INPUT=\$(cat)

$SEGMENTS_FN

printf '%s' "\$(render_okay_segments)"
exit 0
INNER
  chmod +x "$STATUSLINE"
}

# Renders the wrapped variant from whatever is already at $BACKUP — never
# touches $BACKUP itself, so it's safe to call on every install to refresh
# SEGMENTS_FN in an already-wrapped statusline.sh without re-wrapping it.
render_wrapped() {
  # Run the original directly so its shebang is honored (it may not be bash);
  # fall back to bash for a backup that lost its executable bit.
  cat > "$STATUSLINE" <<INNER
#!/usr/bin/env bash
# $MARKER: wrapped (original preserved at $BACKUP)
INPUT=\$(cat)
ORIG_OUT=\$(printf '%s' "\$INPUT" | "$BACKUP" 2>/dev/null || printf '%s' "\$INPUT" | bash "$BACKUP" 2>/dev/null || true)

$SEGMENTS_FN

printf '%s%s' "\$ORIG_OUT" "\$(render_okay_segments)"
exit 0
INNER
  chmod +x "$STATUSLINE"
}

write_wrapped() {
  cp "$STATUSLINE" "$BACKUP"
  render_wrapped
}

do_install() {
  mkdir -p "$HOOKS_DIR"
  # An explicit uninstall is a choice, not a fault to repair. Installing again
  # clears it; the SessionStart hook honors it and stays out.
  rm -f "$OPTOUT" 2>/dev/null || true
  if installed_fresh; then
    write_fresh
    echo "✓ status bar: refreshed okay segment"
  elif installed_wrapped; then
    render_wrapped
    echo "✓ status bar: refreshed okay segment (original preserved at $BACKUP)"
  elif stale_backup; then
    echo "⚠ status bar: $BACKUP exists but $STATUSLINE is not okay's — refusing to overwrite it. Move or delete $BACKUP, then re-run install." >&2
    return 0
  elif [ -f "$STATUSLINE" ]; then
    write_wrapped
    echo "✓ status bar: wrapped existing statusline.sh (original preserved at $BACKUP)"
  else
    write_fresh
    echo "✓ status bar: created statusline.sh with the okay segment"
  fi

  # Registration check runs on every install (including repairs): the segment
  # only renders if settings.json's statusLine actually runs our script. Never
  # overwrite an existing registration — warn instead, so an install can't
  # claim success while the segment silently never renders.
  [ -f "$SETTINGS" ] || echo "{}" > "$SETTINGS"
  if [ "$(jq -r 'has("statusLine")' "$SETTINGS")" = "false" ]; then
    tmp=$(mktemp)
    jq --arg cmd "bash \"$STATUSLINE\"" \
      '.statusLine = {type:"command", command:$cmd}' \
      "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
    echo "✓ settings.json: statusLine registered"
  elif jq -e --arg sl "$STATUSLINE" '(.statusLine.command? // "") | contains($sl)' "$SETTINGS" >/dev/null; then
    echo "• settings.json: statusLine already registered"
  else
    echo "⚠ settings.json: statusLine already runs a different command — the okay segment will NOT render until that command is chained to $STATUSLINE or the statusLine entry is removed and install re-run" >&2
  fi
}

do_uninstall() {
  # Recorded before the branches: the SessionStart hook reads this to know the
  # bar is off by choice, so it stops reinstalling on every new session.
  mkdir -p "$OKAY_DIR" 2>/dev/null || true
  : > "$OPTOUT" 2>/dev/null || true

  if installed_wrapped; then
    mv "$BACKUP" "$STATUSLINE"
    echo "✓ status bar: restored original statusline.sh, okay segment removed"
  elif installed_fresh; then
    rm -f "$STATUSLINE"
    if [ -f "$SETTINGS" ]; then
      tmp=$(mktemp)
      jq --arg sl "$STATUSLINE" \
        'if ((.statusLine.command? // "") | contains($sl)) then del(.statusLine) else . end' \
        "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
    fi
    echo "✓ status bar: removed (was okay-created), statusLine unregistered"
  elif stale_backup; then
    echo "• status bar: okay segment not installed. An old backup is still at $BACKUP — delete it by hand if you no longer need it."
  else
    echo "• status bar: okay segment not installed, nothing to do"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-}" in
    install)   do_install ;;
    uninstall) do_uninstall ;;
    *) echo "usage: statusline-install.sh [install|uninstall]" >&2; exit 1 ;;
  esac
fi
