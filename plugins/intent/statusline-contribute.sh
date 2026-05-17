#!/bin/bash
# statusline contribution: prints a one-line summary of the active intent for
# the current Claude Code session. Source this from your statusline script:
#
#   intent_line=$(/path/to/plugins/intent/statusline-contribute.sh <session_id>)
#   [ -n "$intent_line" ] && echo "$intent_line"
#
# Outputs nothing when there's no active intent.

set -e

session_id="${1:-$CLAUDE_SESSION_ID}"
if [ -z "$session_id" ]; then
  exit 0
fi

plugin_root="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")}"

current=$(CLAUDE_SESSION_ID="$session_id" bun run "${plugin_root}/src/cli.ts" current 2>/dev/null || true)

if [ -z "$current" ]; then
  exit 0
fi

# Truncate to ~70 chars and prefix with a marker. Dim style escape codes.
truncated=$(echo "$current" | cut -c1-70)
if [ "${#current}" -gt 70 ]; then
  truncated="${truncated}…"
fi
printf "\033[2m🎯 %s\033[0m" "$truncated"
