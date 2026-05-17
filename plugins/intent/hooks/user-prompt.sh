#!/bin/bash
# UserPromptSubmit hook: inject the active intent as session context so the
# agent sees it on every turn and can self-check for drift.
#
# Reads JSON from stdin (Claude Code hook input). Outputs an additionalContext
# string when an active intent exists; otherwise silent.

set -e

input=$(cat)

# Extract session_id from the hook input
session_id=$(echo "$input" | jq -r '.session_id // empty')

if [ -z "$session_id" ]; then
  exit 0
fi

# Query the CLI for the active intent text (one line; empty if none)
current=$(CLAUDE_SESSION_ID="$session_id" bun run "${CLAUDE_PLUGIN_ROOT}/src/cli.ts" current 2>/dev/null || true)

if [ -z "$current" ]; then
  exit 0
fi

# Emit additionalContext for the model. Keep it minimal — one line.
jq -n --arg msg "Session intent (anchor): $current" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $msg
  }
}'
