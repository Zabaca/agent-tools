#!/usr/bin/env bash
# red-sweep state machine — enforced via Claude Code hooks.
#
# Single entry point invoked by the SKILL's PreToolUse / PostToolUse / Stop hooks.
# Reads tool-call JSON from stdin, looks up the project's state in
# .red-sweep/state.json, and either allows the action (exit 0) or denies it
# (exit 2 with reason on stderr).
#
# States: INIT (no enforcement), DISCOVERING, FILING. Stop is gated by finding_count.

set -uo pipefail

EVENT="${1:-}"
if [[ -z "$EVENT" ]]; then
  echo "state-machine.sh: missing event arg" >&2
  exit 1
fi

# Read tool input from stdin (Claude Code hook contract)
INPUT="$(cat)"

# cwd field tells us where the project root is. Fall back to $PWD.
CWD="$(jq -r '.cwd // empty' <<<"$INPUT")"
[[ -z "$CWD" ]] && CWD="$PWD"

STATE_DIR="$CWD/.red-sweep"
STATE_FILE="$STATE_DIR/state.json"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

deny() {
  local reason="$1"
  jq -nc --arg r "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

block_stop() {
  local reason="$1"
  jq -nc --arg r "$reason" '{decision: "block", reason: $r}'
  exit 0
}

allow() { exit 0; }

state_get() {
  local key="$1"
  jq -r --arg k "$key" '.[$k] // empty' "$STATE_FILE" 2>/dev/null
}

state_set() {
  # state_set key value  (value is treated as raw JSON; quote strings yourself)
  local key="$1" value="$2"
  local tmp
  tmp="$(mktemp)"
  jq --arg k "$key" --argjson v "$value" '.[$k] = $v' "$STATE_FILE" >"$tmp" \
    && mv "$tmp" "$STATE_FILE"
}

state_set_str() {
  local key="$1" value="$2"
  local tmp
  tmp="$(mktemp)"
  jq --arg k "$key" --arg v "$value" '.[$k] = $v' "$STATE_FILE" >"$tmp" \
    && mv "$tmp" "$STATE_FILE"
}

# Is the path a test file per the project's configured pattern + dir?
is_test_file() {
  local path="$1"
  local pattern dir
  pattern="$(state_get test_pattern)"
  dir="$(state_get test_dir)"
  [[ -z "$pattern" ]] && return 1

  local base
  base="$(basename "$path")"

  # Glob-match basename against pattern
  case "$base" in
    $pattern) ;;
    *) return 1 ;;
  esac

  # If a test_dir is configured, require the path to live under it
  if [[ -n "$dir" ]]; then
    case "$path" in
      *"/$dir/"*|"$dir/"*) return 0 ;;
      *) return 1 ;;
    esac
  fi
  return 0
}

# Count tests in a file using the project's configured marker regex.
# Returns 0 if file doesn't exist.
count_tests() {
  local file="$1"
  local marker
  marker="$(state_get test_marker_regex)"
  [[ -z "$marker" ]] && marker='^\s*(it|test)\s*\('
  if [[ ! -f "$file" ]]; then
    echo 0
    return
  fi
  grep -cE "$marker" "$file" 2>/dev/null || echo 0
}

# Run the project's single-file test command. Returns the command's exit code.
run_single_file_tests() {
  local file="$1"
  local cmd
  cmd="$(state_get test_cmd_single)"
  [[ -z "$cmd" ]] && return 0  # not configured → don't block on this
  local resolved="${cmd//\{file\}/$file}"
  ( cd "$CWD" && bash -c "$resolved" ) >/dev/null 2>&1
}

# Bash command pattern: is this a "destructive" or otherwise-blocked command?
# Used in DISCOVERING/FILING to keep the agent from sneaking around the state machine.
is_blocked_bash() {
  local cmd="$1"
  case "$cmd" in
    *"git commit"*|*"git push"*|*"git reset"*|*"git checkout"*|*"git rebase"*|*"git merge"*) return 0 ;;
    *"rm "*|*"rm -"*) return 0 ;;
  esac
  return 1
}

# Bash command for filing: gh issue create or echo/cat into a findings markdown
is_filing_bash() {
  local cmd="$1"
  case "$cmd" in
    *"gh issue create"*) return 0 ;;
  esac
  return 1
}

# ---------------------------------------------------------------------------
# Bootstrapping: if state.json doesn't exist, treat as INIT — allow everything.
# ---------------------------------------------------------------------------

if [[ ! -f "$STATE_FILE" ]]; then
  # Don't auto-create here; INIT setup is the agent's job. Just stay out of the way.
  allow
fi

CURRENT_STATE="$(state_get state)"
[[ -z "$CURRENT_STATE" ]] && CURRENT_STATE="INIT"

# INIT: no enforcement at all. Agent is still gathering config from the user.
if [[ "$CURRENT_STATE" == "INIT" ]]; then
  allow
fi

TOOL_NAME="$(jq -r '.tool_name // empty' <<<"$INPUT")"

# ---------------------------------------------------------------------------
# STOP event
# ---------------------------------------------------------------------------

if [[ "$EVENT" == "stop" ]]; then
  finding_count="$(state_get finding_count)"; finding_count="${finding_count:-0}"
  loop_limit="$(state_get loop_limit)"; loop_limit="${loop_limit:-10}"
  stop_attempts="$(state_get stop_attempts)"; stop_attempts="${stop_attempts:-0}"

  if (( finding_count > 0 )); then
    allow
  fi

  if (( stop_attempts >= loop_limit )); then
    # Agent has tried enough; let them stop with 0 findings.
    allow
  fi

  new_attempts=$((stop_attempts + 1))
  state_set stop_attempts "$new_attempts"
  block_stop "No findings filed yet. Keep scanning the focus area for issues. (attempt $new_attempts of $loop_limit)"
fi

# ---------------------------------------------------------------------------
# PRE-WRITE / PRE-EDIT
# ---------------------------------------------------------------------------

if [[ "$EVENT" == "pre-write" ]]; then
  file_path="$(jq -r '.tool_input.file_path // empty' <<<"$INPUT")"
  [[ -z "$file_path" ]] && allow

  case "$CURRENT_STATE" in
    DISCOVERING)
      if ! is_test_file "$file_path"; then
        deny "red-sweep DISCOVERING: only test files may be edited. '$file_path' is not a test file (pattern=$(state_get test_pattern), dir=$(state_get test_dir)). Source fixes happen in Phase 2."
      fi

      current_test="$(state_get current_test)"
      if [[ -n "$current_test" && "$current_test" != "$file_path" ]]; then
        deny "red-sweep: a red test already exists at '$current_test' that hasn't been filed. File the finding (gh issue create or append to the findings doc) before writing another test."
      fi

      # Capture baseline test count so PostToolUse can verify exactly +1.
      baseline=$(count_tests "$file_path")
      state_set baseline_test_count "$baseline"
      state_set_str pending_test_file "$file_path"
      allow
      ;;
    FILING)
      tracker="$(state_get tracker)"
      findings_file="$(state_get findings_file)"
      if [[ "$tracker" == "markdown" && -n "$findings_file" ]]; then
        if [[ "$file_path" == "$findings_file" || "$file_path" == "$CWD/$findings_file" ]]; then
          allow
        fi
      fi
      deny "red-sweep FILING: only the findings file ($findings_file) may be edited right now. File the current red test, then return to discovery."
      ;;
    *)
      allow ;;
  esac
fi

# ---------------------------------------------------------------------------
# POST-WRITE / POST-EDIT
# ---------------------------------------------------------------------------

if [[ "$EVENT" == "post-write" ]]; then
  file_path="$(jq -r '.tool_input.file_path // empty' <<<"$INPUT")"
  [[ -z "$file_path" ]] && allow

  if [[ "$CURRENT_STATE" != "DISCOVERING" ]]; then
    allow
  fi

  if ! is_test_file "$file_path"; then
    allow
  fi

  baseline="$(state_get baseline_test_count)"; baseline="${baseline:-0}"
  new_count=$(count_tests "$file_path")

  delta=$(( new_count - baseline ))

  if (( delta == 0 )); then
    deny "red-sweep: write to '$file_path' did not add a new test (baseline=$baseline, after=$new_count). The red test is the exploration tool — add exactly one failing test."
  fi

  if (( delta > 1 )); then
    deny "red-sweep: write to '$file_path' added $delta tests. Only ONE failing test at a time. Remove the extras."
  fi

  # delta == 1 — verify the test actually fails.
  if run_single_file_tests "$file_path"; then
    deny "red-sweep: tests in '$file_path' pass. A red sweep test must FAIL — it has to prove an issue exists. Rewrite or remove it."
  fi

  # Good red test. Lock state until the finding is filed.
  state_set_str current_test "$file_path"
  state_set_str state "FILING"
  allow
fi

# ---------------------------------------------------------------------------
# PRE-BASH
# ---------------------------------------------------------------------------

if [[ "$EVENT" == "pre-bash" ]]; then
  cmd="$(jq -r '.tool_input.command // empty' <<<"$INPUT")"

  case "$CURRENT_STATE" in
    DISCOVERING)
      if is_blocked_bash "$cmd"; then
        deny "red-sweep DISCOVERING: '$cmd' is blocked. No commits, resets, or destructive ops during discovery."
      fi
      allow
      ;;
    FILING)
      if is_filing_bash "$cmd"; then
        # Count this as filing. Increment finding_count and return to DISCOVERING.
        fc="$(state_get finding_count)"; fc="${fc:-0}"
        new_fc=$((fc + 1))
        state_set finding_count "$new_fc"
        state_set_str state "DISCOVERING"
        state_set_str current_test ""
        allow
      fi
      if is_blocked_bash "$cmd"; then
        deny "red-sweep FILING: '$cmd' is blocked. File the current finding via 'gh issue create' or by editing the findings doc."
      fi
      # Read-ish bash (grep, ls, cat) is fine.
      allow
      ;;
    *)
      allow ;;
  esac
fi

# Unknown event → allow but log.
echo "state-machine.sh: unknown event '$EVENT'" >&2
exit 0
