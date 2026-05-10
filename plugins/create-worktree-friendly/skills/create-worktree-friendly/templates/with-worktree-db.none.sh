#!/usr/bin/env bash
#
# DB-less passthrough. The project has no DB tool detected, so this
# wrapper just preserves the parallel-test invocation contract: it
# does no env munging and execs the wrapped command. Kept so
# `package.json` scripts can compose `with-worktree-port.sh` →
# `with-worktree-db.sh` → `<runner>` uniformly across projects.
#
# If a DB is added later, replace this file with the Prisma or
# Drizzle template.

set -euo pipefail
exec "$@"
