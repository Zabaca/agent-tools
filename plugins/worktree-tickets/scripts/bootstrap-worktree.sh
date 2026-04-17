#!/usr/bin/env bash
# WorktreeCreate hook: create a git worktree for an isolation-worktree
# subagent and seed it with configured env files.
#
# Registering a WorktreeCreate hook replaces Claude Code's built-in git
# worktree creation, so this script must `git worktree add` itself and echo
# the final path on stdout.
#
# Configuration (optional) at `<project-root>/.worktree-tickets.json`:
# {
#   "seed": [".env", "packages/api/.env"],
#   "direnv_allow": true
# }
#
# Defaults: seed=[".env"], direnv_allow=true.

set -uo pipefail

log() { echo "[worktree-tickets/bootstrap] $*" >&2; }

SRC="${CLAUDE_PROJECT_DIR:?CLAUDE_PROJECT_DIR not set}"

NAME=""
if [[ ! -t 0 ]] && command -v jq >/dev/null 2>&1; then
  payload="$(cat || true)"
  if [[ -n "$payload" ]]; then
    NAME="$(jq -r '.name // empty' <<<"$payload")"
  fi
fi

if [[ -z "$NAME" ]]; then
  log "no worktree name in stdin — aborting"
  exit 1
fi

DST="$SRC/.claude/worktrees/$NAME"
BRANCH="worktree-$NAME"

if [[ -d "$DST" ]]; then
  log "reusing existing dir $DST"
else
  (cd "$SRC" && git worktree add -b "$BRANCH" "$DST" HEAD) >&2 || {
    log "git worktree add failed"
    exit 1
  }
  log "created worktree $DST on $BRANCH"
fi

CONFIG="$SRC/.worktree-tickets.json"
SEED_FILES=(".env")
DIRENV_ALLOW="true"
if [[ -f "$CONFIG" ]] && command -v jq >/dev/null 2>&1; then
  mapfile -t SEED_FILES < <(jq -r '.seed // [".env"] | .[]' "$CONFIG")
  DIRENV_ALLOW="$(jq -r '.direnv_allow // true' "$CONFIG")"
fi

for rel in "${SEED_FILES[@]}"; do
  [[ -z "$rel" ]] && continue
  if [[ -f "$SRC/$rel" ]]; then
    mkdir -p "$(dirname "$DST/$rel")"
    cp "$SRC/$rel" "$DST/$rel"
    log "seeded $rel"
  fi
done

if [[ "$DIRENV_ALLOW" == "true" ]] && command -v direnv >/dev/null 2>&1 && [[ -f "$DST/.envrc" ]]; then
  (cd "$DST" && direnv allow .) >&2 || log "direnv allow failed (non-fatal)"
fi

log "done"
echo "$DST"
