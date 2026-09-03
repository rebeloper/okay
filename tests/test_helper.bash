# Installs a fake `curl` on PATH that returns canned responses.
#
# For JSON calls (no -o flag): prints "$MOCK_VALIDATE_BODY\n$MOCK_VALIDATE_CODE"
# or "$MOCK_DOWNLOAD_BODY\n$MOCK_DOWNLOAD_CODE" depending on whether the last
# argument (the URL) ends in /validate or /download.
#
# For file downloads (-o <path> present): copies $MOCK_ZIP_FIXTURE to <path>
# if set, otherwise writes nothing.
#
# MOCK_CURL_EXIT (default 0) is always the fake curl's exit status.
mock_bin_setup() {
  MOCK_BIN="$BATS_TEST_TMPDIR/mockbin"
  mkdir -p "$MOCK_BIN"

  # Ensure homebrew bash is on PATH for negative array subscripts (bash 4+ feature)
  if [[ -x /opt/homebrew/bin/bash ]]; then
    PATH="/opt/homebrew/bin:$PATH"
  fi
  cat > "$MOCK_BIN/curl" <<'CURL_EOF'
#!/usr/bin/env bash
args=("$@")
url="${args[-1]}"
out=""
for ((i = 0; i < ${#args[@]}; i++)); do
  [[ "${args[$i]}" == "-o" ]] && out="${args[$((i + 1))]}"
done

if [[ -n "$out" ]]; then
  [[ -n "${MOCK_ZIP_FIXTURE:-}" ]] && cp "$MOCK_ZIP_FIXTURE" "$out"
  exit "${MOCK_CURL_EXIT:-0}"
fi

case "$url" in
  */validate) printf '%s\n%s' "${MOCK_VALIDATE_BODY:-}" "${MOCK_VALIDATE_CODE:-200}" ;;
  */download) printf '%s\n%s' "${MOCK_DOWNLOAD_BODY:-}" "${MOCK_DOWNLOAD_CODE:-200}" ;;
  *) printf '\n200' ;;
esac
exit "${MOCK_CURL_EXIT:-0}"
CURL_EOF
  chmod +x "$MOCK_BIN/curl"

  # Mirrors the real CLI's list format: entries are indented under a header
  # as "  ❯ name@marketplace" — never at column 0 (a column-0 anchor in
  # plugin_registered shipped broken because this mock was idealized).
  cat > "$MOCK_BIN/claude" <<'CLAUDE_EOF'
#!/usr/bin/env bash
if [[ "$1 $2" == "plugin list" ]]; then
  echo "Installed plugins:"
  echo ""
  if [[ "${MOCK_CLAUDE_REGISTERED:-0}" == "1" ]]; then
    echo "  ❯ okay@okay"
    echo "    Version: 0.1.0"
    echo "    Status: ✔ enabled"
  fi
  exit 0
fi
exit "${MOCK_CLAUDE_EXIT:-0}"
CLAUDE_EOF
  chmod +x "$MOCK_BIN/claude"

  PATH="$MOCK_BIN:$PATH"
}
