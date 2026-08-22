#!/usr/bin/env bash
#
# Test-DB isolation, automatic per-worktree.
#
# Derives DATABASE_URL / DATABASE_URL_UNPOOLED from the worktree
# directory name and execs the given command with that env. Tests
# in the main checkout use the canonical `{{DB_NAME_BASE}}`; tests
# run from a worktree like `{{PROJECT_NAME}}-cluster-foo/` use
# `{{DB_NAME_BASE}}_cluster_foo`.
#
# Wired into the test scripts so isolation happens by construction —
# multiple worktrees can run tests concurrently without stepping on
# each other's tables.
#
# Auto-creates the per-worktree DB on first use (via `prisma db
# execute` against the `postgres` maintenance DB — no local psql
# / createdb required) and applies the schema + any sequence /
# seed bootstrap whenever `prisma/schema.prisma` changes.

set -euo pipefail

TOPLEVEL=$(git rev-parse --show-toplevel)
WORKTREE_NAME=$(basename "$TOPLEVEL")

# Postgres DB names: lowercase, underscores not hyphens.
WORKTREE_NAME_NORMALIZED=$(echo "$WORKTREE_NAME" | tr '[:upper:]' '[:lower:]' | tr '-' '_')

if ! [[ "$WORKTREE_NAME_NORMALIZED" =~ ^[a-z0-9_]+$ ]]; then
  echo "with-worktree-db: refusing to derive DB name from '$WORKTREE_NAME'" >&2
  exit 1
fi

# Main checkout (the bare project name) keeps the canonical DB.
# Worktrees get a per-name DB suffixed off the canonical base.
PROJECT_PREFIX="{{PROJECT_NAME_NORMALIZED}}"
DB_NAME_BASE="{{DB_NAME_BASE}}"

if [ "$WORKTREE_NAME_NORMALIZED" = "$PROJECT_PREFIX" ]; then
  DB="$DB_NAME_BASE"
else
  # Strip the project prefix so a worktree named "{{PROJECT_NAME}}-foo"
  # produces "{{DB_NAME_BASE}}_foo", not "{{DB_NAME_BASE}}_{{PROJECT_NAME}}_foo".
  SUFFIX="${WORKTREE_NAME_NORMALIZED#${PROJECT_PREFIX}_}"
  DB="${DB_NAME_BASE}_${SUFFIX}"
fi

# Swap the database (the last path segment) of a Postgres URL, preserving
# user / password / host / port and any ?query string.
#
# We deliberately do NOT do a blanket `${url//\/$old/\/$new}` replace: when
# the DB name also appears as the username (e.g. user=app, db=app) that
# pattern matches the `//` in `postgresql://app...` and corrupts the
# username. Splitting on the final `/` only touches the DB segment.
swap_db() {
  local url="$1" newdb="$2" base query
  case "$url" in
    *\?*) base="${url%%\?*}"; query="?${url#*\?}";;
    *)    base="$url";        query="";;
  esac
  printf '%s/%s%s' "${base%/*}" "$newdb" "$query"
}

# Compose DATABASE_URL by swapping the database name in the URL from
# {{ENV_TEST_FILE}}. Preserves user / password / host / port / query params.
ORIG_URL=$(grep -E "^DATABASE_URL=" {{ENV_TEST_FILE}} 2>/dev/null | head -1 | cut -d= -f2-)
if [ -z "${ORIG_URL:-}" ]; then
  echo "with-worktree-db: DATABASE_URL not found in {{ENV_TEST_FILE}}" >&2
  exit 1
fi
NEW_URL="$(swap_db "$ORIG_URL" "$DB")"

ORIG_UNPOOLED=$(grep -E "^DATABASE_URL_UNPOOLED=" {{ENV_TEST_FILE}} 2>/dev/null | head -1 | cut -d= -f2- || true)
if [ -n "${ORIG_UNPOOLED:-}" ]; then
  NEW_UNPOOLED="$(swap_db "$ORIG_UNPOOLED" "$DB")"
  export DATABASE_URL_UNPOOLED="$NEW_UNPOOLED"
fi

export DATABASE_URL="$NEW_URL"

# Auto-create the per-worktree DB on first use.
JUST_CREATED=0
if ! DATABASE_URL="$NEW_URL" DATABASE_URL_UNPOOLED="${NEW_UNPOOLED:-$NEW_URL}" npx --no-install prisma db execute --schema prisma/schema.prisma --stdin <<<"SELECT 1" >/dev/null 2>&1; then
  echo "[worktree-db] $DB not reachable — attempting to create..."
  ADMIN_URL="$(swap_db "$NEW_URL" postgres)"
  ADMIN_UNPOOLED="$(swap_db "${NEW_UNPOOLED:-$NEW_URL}" postgres)"
  if ! DATABASE_URL="$ADMIN_URL" DATABASE_URL_UNPOOLED="${ADMIN_UNPOOLED:-$ADMIN_URL}" npx --no-install prisma db execute --schema prisma/schema.prisma --stdin <<<"CREATE DATABASE \"$DB\""; then
    echo "[worktree-db] failed to create $DB. Check that Postgres is up." >&2
    exit 1
  fi
  echo "[worktree-db] created $DB."
  JUST_CREATED=1
fi

# Auto-apply schema + bootstrap whenever `prisma/schema.prisma` changes
# since the last bootstrap. Marker lives in `node_modules/.cache/` so it's
# per-worktree and disappears with a fresh install. `openssl dgst -sha256`
# is used over `sha256sum` / `shasum` so the script behaves the same on
# Linux + macOS.
SCHEMA_HASH=$(openssl dgst -sha256 prisma/schema.prisma | awk '{print $NF}')
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
  echo "[worktree-db] applying schema to $DB (db push{{SEQUENCE_BOOTSTRAP_LABEL}})..."
  DATABASE_URL="$NEW_URL" DATABASE_URL_UNPOOLED="${NEW_UNPOOLED:-$NEW_URL}" \
    npx --no-install prisma db push --schema prisma/schema.prisma --skip-generate --accept-data-loss
{{SEQUENCE_BOOTSTRAP_BLOCK}}
  echo "$SCHEMA_HASH" > "$HASH_FILE"
fi

exec "$@"
