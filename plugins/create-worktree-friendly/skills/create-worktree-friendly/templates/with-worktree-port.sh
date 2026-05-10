#!/usr/bin/env bash
#
# Per-worktree port assignment for dev servers and e2e runs.
#
# Hashes `basename(toplevel)` into [{{PORT_LOW}}, {{PORT_HIGH}}) and exports:
#   PORT          — the derived port (Next.js / Vite / etc. dev flag)
#   E2E_BASE_URL  — http://localhost:$PORT (Playwright baseURL)
#   E2E_MODE=1    — flag that hot-path routes can read to short-circuit
#                   real upstream calls (NMI, FMCSA, email, etc.) for
#                   hermetic e2e. Routes MUST belt-and-suspenders this
#                   with `NODE_ENV !== 'production'` to guarantee the
#                   shim is unreachable in prod.
#
# Mirrors the derivation pattern of with-worktree-db.sh so the same
# worktree always gets the same DB *and* the same port — debugging is
# predictable and `lsof -i :$PORT` is informative.

set -euo pipefail

TOPLEVEL=$(git rev-parse --show-toplevel)
WORKTREE_NAME=$(basename "$TOPLEVEL")

WORKTREE_NAME_NORMALIZED=$(echo "$WORKTREE_NAME" | tr '[:upper:]' '[:lower:]' | tr '-' '_')

if ! [[ "$WORKTREE_NAME_NORMALIZED" =~ ^[a-z0-9_]+$ ]]; then
  echo "with-worktree-port: refusing to derive port from '$WORKTREE_NAME'" >&2
  exit 1
fi

PORT_LOW={{PORT_LOW}}
PORT_HIGH={{PORT_HIGH}}
RANGE=$((PORT_HIGH - PORT_LOW))

# md5 over the normalized name, take the leading 8 hex chars, modulo into
# the range. md5 is fine here — we're not relying on it cryptographically,
# just for uniform distribution. md5 is available on both macOS (via
# `md5`) and Linux (via `md5sum`); we prefer `openssl` because it's
# present on both.
HASH_HEX=$(printf '%s' "$WORKTREE_NAME_NORMALIZED" | openssl dgst -md5 | awk '{print $NF}')
HASH_NUM=$((16#${HASH_HEX:0:8}))
PORT=$((PORT_LOW + (HASH_NUM % RANGE)))

export PORT
export E2E_BASE_URL="http://localhost:${PORT}"
export E2E_MODE=1

exec "$@"
