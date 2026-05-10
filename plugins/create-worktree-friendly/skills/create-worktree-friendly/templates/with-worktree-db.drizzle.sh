#!/usr/bin/env bash
#
# Test-DB isolation, automatic per-worktree (Drizzle).
#
# Derives DATABASE_URL from the worktree directory name and execs the
# given command with that env. Tests in the main checkout use the
# canonical `{{DB_NAME_BASE}}`; worktrees branch onto `{{DB_NAME_BASE}}_<suffix>`.
#
# Auto-creates the per-worktree DB on first use (via `psql` against the
# `postgres` maintenance DB) and applies the schema with `drizzle-kit
# push` whenever any file under `drizzle/` changes since the last
# bootstrap.

set -euo pipefail

TOPLEVEL=$(git rev-parse --show-toplevel)
WORKTREE_NAME=$(basename "$TOPLEVEL")

WORKTREE_NAME_NORMALIZED=$(echo "$WORKTREE_NAME" | tr '[:upper:]' '[:lower:]' | tr '-' '_')

if ! [[ "$WORKTREE_NAME_NORMALIZED" =~ ^[a-z0-9_]+$ ]]; then
  echo "with-worktree-db: refusing to derive DB name from '$WORKTREE_NAME'" >&2
  exit 1
fi

PROJECT_PREFIX="{{PROJECT_NAME_NORMALIZED}}"
DB_NAME_BASE="{{DB_NAME_BASE}}"

if [ "$WORKTREE_NAME_NORMALIZED" = "$PROJECT_PREFIX" ]; then
  DB="$DB_NAME_BASE"
else
  SUFFIX="${WORKTREE_NAME_NORMALIZED#${PROJECT_PREFIX}_}"
  DB="${DB_NAME_BASE}_${SUFFIX}"
fi

ORIG_URL=$(grep -E "^DATABASE_URL=" {{ENV_TEST_FILE}} 2>/dev/null | head -1 | cut -d= -f2-)
if [ -z "${ORIG_URL:-}" ]; then
  echo "with-worktree-db: DATABASE_URL not found in {{ENV_TEST_FILE}}" >&2
  exit 1
fi
NEW_URL="${ORIG_URL//\/${DB_NAME_BASE}/\/${DB}}"
export DATABASE_URL="$NEW_URL"

# Probe + auto-create. Drizzle ships no equivalent of `prisma db execute`,
# so we use `psql` directly. Most contributors have it installed via
# postgresql-client; if not, document it as a prereq in the worktree skill.
JUST_CREATED=0
if ! psql "$NEW_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "[worktree-db] $DB not reachable — attempting to create..."
  ADMIN_URL="${NEW_URL//\/${DB}/\/postgres}"
  if ! psql "$ADMIN_URL" -c "CREATE DATABASE \"$DB\"" >/dev/null 2>&1; then
    echo "[worktree-db] failed to create $DB. Is psql installed and Postgres up?" >&2
    exit 1
  fi
  echo "[worktree-db] created $DB."
  JUST_CREATED=1
fi

# Hash the entire `drizzle/` directory (schema + migrations) so any
# change triggers a re-push.
SCHEMA_HASH=$(find drizzle -type f \( -name "*.sql" -o -name "*.ts" -o -name "*.json" \) -print0 2>/dev/null | sort -z | xargs -0 openssl dgst -sha256 2>/dev/null | openssl dgst -sha256 | awk '{print $NF}')
HASH_DIR="$TOPLEVEL/node_modules/.cache/with-worktree-db"
HASH_FILE="$HASH_DIR/${DB}.schema-hash"
mkdir -p "$HASH_DIR"

NEEDS_BOOTSTRAP=0
if [ "$JUST_CREATED" = "1" ]; then
  NEEDS_BOOTSTRAP=1
elif [ ! -f "$HASH_FILE" ] || [ "$(cat "$HASH_FILE")" != "$SCHEMA_HASH" ]; then
  NEEDS_BOOTSTRAP=1
fi

if [ "$NEEDS_BOOTSTRAP" = "1" ]; then
  echo "[worktree-db] applying schema to $DB (drizzle-kit push)..."
  DATABASE_URL="$NEW_URL" npx --no-install drizzle-kit push
  echo "$SCHEMA_HASH" > "$HASH_FILE"
fi

exec "$@"
