/**
 * Playwright global setup.
 *
 * `with-worktree-db.sh` already creates the worktree DB, applies the
 * schema, and runs any sequence/seed bootstrap before this file runs —
 * so by the time Playwright invokes globalSetup, the DB is in a known-
 * good state. Keep this file as a no-op until a future need (auth
 * fixture seeding, magic-link inbox setup, etc.) requires test-specific
 * setup that the wrapper shouldn't be responsible for.
 *
 * If you find yourself adding logic here, prefer to push it down into
 * `scripts/with-worktree-db.sh` so non-Playwright runs (Vitest, manual
 * `psql` against the worktree DB) get it too.
 */
export default async function globalSetup() {
  // intentionally empty
}
