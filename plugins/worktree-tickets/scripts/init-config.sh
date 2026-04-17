#!/usr/bin/env bash
# Write a default .worktree-tickets.json at the repo root.
# Idempotent — refuses to overwrite an existing config.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$REPO_ROOT/.worktree-tickets.json"

if [[ -f "$CONFIG" ]]; then
  echo "config already exists at $CONFIG — not overwriting" >&2
  exit 0
fi

REPO_SLUG="$(basename "$REPO_ROOT")"

# Detect a plausible default base branch (origin/main if present, else origin/master, else main).
BASE_BRANCH="main"
if git -C "$REPO_ROOT" show-ref --verify --quiet refs/remotes/origin/main; then
  BASE_BRANCH="main"
elif git -C "$REPO_ROOT" show-ref --verify --quiet refs/remotes/origin/master; then
  BASE_BRANCH="master"
fi

cat > "$CONFIG" <<EOF
{
  "base_branch": "$BASE_BRANCH",
  "team_name": "tickets-$REPO_SLUG",
  "worktree_parent": "..",
  "worktree_prefix": "stack-",
  "branch_prefix": "ticket/",
  "seed": [".env"],
  "direnv_allow": true,
  "post_create": []
}
EOF

echo "wrote $CONFIG" >&2
echo "$CONFIG"
