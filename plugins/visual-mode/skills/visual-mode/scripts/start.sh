#!/usr/bin/env bash
# Start the .visual-mode dev server on a deterministic per-repo port.
# Usage: start.sh [--port-only]
# Runs in the FOREGROUND — launch via a backgrounded shell.
set -euo pipefail

TARGET=".visual-mode"

# Deterministic port from repo path: same repo → same port; different repos
# (and worktrees) → different ports. Range 4300-5299.
PORT=$((4300 + $(pwd | cksum | cut -d' ' -f1) % 1000))

if [ "${1:-}" = "--port-only" ]; then
  echo "$PORT"
  exit 0
fi

[ -d "$TARGET/src" ] || { echo "ERROR: $TARGET not scaffolded — run bootstrap.sh first" >&2; exit 1; }

# Already running? (e.g. from a previous session)
if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/"; then
  echo "already-running: http://localhost:$PORT/"
  exit 0
fi

echo "starting visual-mode on http://localhost:$PORT/"
cd "$TARGET"
exec bun run dev --port "$PORT"
