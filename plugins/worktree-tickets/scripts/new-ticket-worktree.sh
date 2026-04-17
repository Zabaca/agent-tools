#!/usr/bin/env bash
# Create a fresh per-ticket git worktree rooted on a base branch, seed env
# files, and run configured post-create install commands.
#
# Usage: new-ticket-worktree.sh <ticket-id> [base-branch]
#
# Example:
#   new-ticket-worktree.sh PNP-1234
#   → ../stack-PNP-1234 on branch ticket/PNP-1234 from origin/main
#
# Configuration (optional) at `<project-root>/.worktree-tickets.json`:
# {
#   "base_branch": "main",
#   "worktree_parent": "..",
#   "worktree_prefix": "stack-",
#   "branch_prefix": "ticket/",
#   "seed": [".env"],
#   "direnv_allow": true,
#   "post_create": [
#     { "dir": "packages/dbt", "cmd": "uv sync" },
#     { "dir": "packages/evidence", "cmd": "npm install" }
#   ]
# }

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $(basename "$0") <ticket-id> [base-branch]" >&2
  exit 2
fi

TICKET_ID="$1"
SAFE_ID="$(printf '%s' "$TICKET_ID" | tr -c '[:alnum:]_.-' '-')"

REPO_ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$REPO_ROOT/.worktree-tickets.json"

jq_get() {
  local path="$1" default="$2"
  if [[ -f "$CONFIG" ]] && command -v jq >/dev/null 2>&1; then
    local v
    v="$(jq -r "$path // empty" "$CONFIG")"
    [[ -n "$v" ]] && echo "$v" && return
  fi
  echo "$default"
}

BASE_BRANCH="${2:-$(jq_get '.base_branch' main)}"
WT_PARENT="$(jq_get '.worktree_parent' '..')"
WT_PREFIX="$(jq_get '.worktree_prefix' 'stack-')"
BR_PREFIX="$(jq_get '.branch_prefix' 'ticket/')"

if [[ "$WT_PARENT" = /* ]]; then
  PARENT_DIR="$WT_PARENT"
else
  PARENT_DIR="$(cd "$REPO_ROOT/$WT_PARENT" && pwd)"
fi

DST="$PARENT_DIR/${WT_PREFIX}${SAFE_ID}"
BRANCH="${BR_PREFIX}${SAFE_ID}"

log() { echo "[new-ticket-worktree] $*" >&2; }

if [[ -e "$DST" ]]; then
  log "ERROR: $DST already exists"
  exit 1
fi

log "fetching $BASE_BRANCH"
git -C "$REPO_ROOT" fetch origin "$BASE_BRANCH" --quiet

log "creating worktree $DST on $BRANCH (from origin/$BASE_BRANCH)"
git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$DST" "origin/$BASE_BRANCH"

# Seed env files.
if [[ -f "$CONFIG" ]] && command -v jq >/dev/null 2>&1; then
  mapfile -t SEED_FILES < <(jq -r '.seed // [".env"] | .[]' "$CONFIG")
else
  SEED_FILES=(".env")
fi
for rel in "${SEED_FILES[@]}"; do
  [[ -z "$rel" ]] && continue
  if [[ -f "$REPO_ROOT/$rel" ]]; then
    mkdir -p "$(dirname "$DST/$rel")"
    cp "$REPO_ROOT/$rel" "$DST/$rel"
    log "seeded $rel"
  fi
done

# direnv allow.
DIRENV_ALLOW="$(jq_get '.direnv_allow' 'true')"
if [[ "$DIRENV_ALLOW" == "true" ]] && command -v direnv >/dev/null 2>&1 && [[ -f "$DST/.envrc" ]]; then
  (cd "$DST" && direnv allow .) || log "direnv allow failed (non-fatal)"
fi

# Post-create install commands.
if [[ -f "$CONFIG" ]] && command -v jq >/dev/null 2>&1; then
  len="$(jq -r '.post_create | length // 0' "$CONFIG")"
  for ((i=0; i<len; i++)); do
    dir="$(jq -r ".post_create[$i].dir" "$CONFIG")"
    cmd="$(jq -r ".post_create[$i].cmd" "$CONFIG")"
    [[ -z "$dir" || -z "$cmd" ]] && continue
    target="$DST/$dir"
    if [[ ! -d "$target" ]]; then
      log "skip: $dir not present in worktree"
      continue
    fi
    log "running in $dir: $cmd"
    (cd "$target" && bash -c "$cmd") || log "command failed in $dir (non-fatal)"
  done
fi

log "done"
echo "$DST"
