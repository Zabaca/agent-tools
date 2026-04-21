#!/usr/bin/env bash
# PreToolUse hook for Bash: if an .envrc lives at or above the session cwd,
# rewrite the command to run under `direnv exec` so env vars load even for
# non-interactive shells. Preserves the session cwd inside the wrapped shell.
#
# No-op if either `jq` or `direnv` is missing.

set -euo pipefail

if ! command -v jq >/dev/null 2>&1 || ! command -v direnv >/dev/null 2>&1; then
  exit 0
fi

input="$(cat)"
cwd="$(jq -r '.cwd // empty' <<<"$input")"
cmd="$(jq -r '.tool_input.command // empty' <<<"$input")"

[[ -z "$cwd" || -z "$cmd" ]] && exit 0

# Pass pure `cd <path>` through unwrapped so the harness's cwd-persistence
# detector can see it and update its tracked cwd. Wrapping would hide the
# pattern behind `direnv exec ... bash -c "..."` and the harness would never
# advance cwd, pinning every future Bash call to the original directory.
trimmed="${cmd#"${cmd%%[![:space:]]*}"}"
trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
if [[ "$trimmed" == cd\ * || "$trimmed" == "cd" ]]; then
  if [[ "$trimmed" != *[\;\&\|\<\>\`]* && "$trimmed" != *'$('* && "$trimmed" != *$'\n'* ]]; then
    exit 0
  fi
fi

envrc_dir=""
dir="$cwd"
while [[ "$dir" != "/" && -n "$dir" ]]; do
  if [[ -f "$dir/.envrc" ]]; then
    envrc_dir="$dir"
    break
  fi
  dir="$(cd "$dir/.." 2>/dev/null && pwd)" || break
done

[[ -z "$envrc_dir" ]] && exit 0

inner="cd $(printf %q "$cwd") && $cmd"
new_cmd="direnv exec $(printf %q "$envrc_dir") bash -c $(printf %q "$inner")"

jq -n --arg c "$new_cmd" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    updatedInput: { command: $c }
  }
}'
