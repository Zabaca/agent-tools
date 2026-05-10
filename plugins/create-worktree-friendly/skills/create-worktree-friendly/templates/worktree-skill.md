---
name: worktree
description: How parallel-safe git-worktree development works in this repo — per-worktree DB, per-worktree dev/e2e port, the E2E_MODE shim convention, the Playwright authoring loop, and the conventions for adding tests, dev work, and new shims without breaking parallel safety. Use when working in a worktree (running tests, dev server, or e2e), authoring a new e2e spec, adding a hermetic shim for an external upstream, or onboarding to how this repo handles parallel agents.
user-invocable: true
---

# Worktree Development

This repo is bootstrapped for parallel git-worktree work. Multiple
worktrees can run dev servers, tests, and e2e specs at the same time
without colliding on ports or databases. This skill is the source of
truth for *how* — read it before doing any of the following:

- Running tests, the dev server, or e2e from a worktree.
- Adding a new e2e spec.
- Adding a hermetic shim for a route that calls an external upstream.
- Spawning a subagent to work in another worktree.
- Debugging a "DB doesn't exist" / "port already in use" error.

---

## Architecture

Two wrappers compose. Both derive their values deterministically from
`basename(toplevel)`, so the same worktree always gets the same DB and
the same port — debugging is predictable.

### `scripts/with-worktree-db.sh`

- Reads `DATABASE_URL` from `{{ENV_TEST_FILE}}`.
- Swaps the DB name segment from `{{DB_NAME_BASE}}` → `{{DB_NAME_BASE}}_<suffix>`,
  where `<suffix>` is the worktree's normalized basename minus the
  project prefix. The main checkout keeps the canonical `{{DB_NAME_BASE}}`.
- Auto-creates the per-worktree DB on first use.
- Applies the schema (and any sequence/seed bootstrap) on first use *or*
  whenever the schema file changes (hash marker in `node_modules/.cache/`).
- Execs the wrapped command with the right `DATABASE_URL`.

### `scripts/with-worktree-port.sh`

- Hashes `basename(toplevel)` into `[{{PORT_LOW}}, {{PORT_HIGH}})`.
- Exports:
  - `PORT` — for the dev server (`{{PKG_MGR}} dev -p $PORT`).
  - `E2E_BASE_URL` — for Playwright `baseURL`.
  - `E2E_MODE=1` — for hot-path routes to short-circuit external calls.

The two wrappers are designed to compose: `with-worktree-port.sh
with-worktree-db.sh <runner>` is the canonical e2e command.

---

## Running things in a worktree

```sh
# tests (Vitest + whatever else `test` runs)
{{PKG_MGR}} test

# dev server, isolated port
{{PKG_MGR}} dev:e2e

# full e2e (Playwright over the dev server, isolated DB + port)
{{PKG_MGR}} test:e2e

# Playwright UI mode for iterating
{{PKG_MGR}} test:e2e:ui

# Playwright codegen against the running dev server
{{PKG_MGR}} test:e2e:codegen
```

Open multiple worktrees and run all of these in parallel. They will
each hit a different DB and a different port. No coordination needed.

---

## The `E2E_MODE` shim convention

Hot-path routes that call external upstreams (payment gateways, FMCSA
SAFER, outbound email, etc.) should short-circuit those calls when
`process.env.E2E_MODE === '1'` and return a deterministic response
matching the live shape. This makes e2e:

- **Hermetic** — no flaky upstream dependency.
- **Fast** — no network round-trips.
- **Parallel-safe** — no rate limits, no shared sandbox state.

### The pattern

```ts
// src/app/api/.../route.ts

export async function POST(req: NextRequest) {
  // ... auth checks first (per CLAUDE.md), then:

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.E2E_MODE === '1'
  ) {
    return NextResponse.json({
      // shape MUST match the live success response exactly
      success: true,
      // deterministic-ish IDs so logs are debuggable
      transactionId: 'e2e-' + crypto.randomUUID(),
      // ...
    });
  }

  // real implementation continues
}
```

### Rules for shims

1. **Belt-and-suspenders the prod gate.** `NODE_ENV !== 'production'`
   AND `E2E_MODE === '1'`. Either alone is not enough.
2. **Place the shim AFTER auth checks**, before any DB read or external
   call. This is critical — if a future security regression skips auth,
   we want the e2e-mode response to surface that regression, not paper
   over it.
3. **Match the live response shape exactly.** Every field. Reviewer
   checklist: skim the success branch and confirm the shim returns the
   same keys with plausible types.
4. **Don't shim list / index / search endpoints** — those don't call
   externals. Shim only the routes whose external calls would block
   e2e (payment, email send, third-party verification).

### Adding a new shim

1. Identify the upstream-dependent branch in the route.
2. Add the gated early return at the top of the handler (after auth).
3. Update any e2e specs that exercise the route — they should now pass
   without setting up upstream sandbox credentials.
4. Mention the new shim in the PR body so reviewers know what changed.

---

## Authoring a new e2e spec

The Playwright MCP plugin is registered in `.mcp.json`. Use it to
discover locators against the live form rather than guessing.

### The loop

1. Start the dev server in this worktree:

   ```sh
   {{PKG_MGR}} dev:e2e &
   ```

2. The wrapper printed `$PORT` / `$E2E_BASE_URL`. Drive the MCP at that
   URL:

   - `mcp__playwright__browser_navigate` → `$E2E_BASE_URL/<path>`
   - `mcp__playwright__browser_snapshot` → returns the accessibility
     tree with paste-ready locators (`page.getByRole('button', { name:
     /submit/i })` etc.).
   - `mcp__playwright__browser_click`, `_fill`, `_type` to validate
     the flow interactively.

3. Copy the locators from the snapshot output verbatim into a new
   `e2e/specs/<flow>.spec.ts`. Locators that come out of MCP snapshots
   are stable; locators you guess are not.

4. Run the spec:

   ```sh
   {{PKG_MGR}} test:e2e -- <flow>.spec.ts
   ```

5. Iterate until green. Commit.

### Spec conventions

- Import `test` and `expect` from `e2e/fixtures/test.ts` (not
  `@playwright/test` directly). When per-spec fixtures are added later
  (admin cookie, customer cookie, etc.), specs that import from
  fixtures will get them for free.
- Use unique-per-run identifiers (e.g.
  `` `e2e-${Date.now()}@example.com` ``) so the spec doesn't collide
  with itself if it's been run before in this worktree's DB.
- Verify auth cookie behavior explicitly when the flow sets one. The
  dotmcs BOC-3 smoke pattern is: submit form → land on thank-you →
  navigate to a route that requires the cookie and assert the page
  loaded. That third step is what catches "the cookie wasn't set
  correctly" regressions.
- Don't `test.skip` / `test.fixme` to make CI green. Either fix the
  spec or remove it.

---

## Working in a fresh worktree

```sh
git worktree add ../{{PROJECT_NAME}}-<topic> -b <branch> origin/main
cd ../{{PROJECT_NAME}}-<topic>
{{PKG_MGR}} install
# first test run auto-creates the per-worktree DB:
{{PKG_MGR}} test
# first dev:e2e auto-derives the port:
{{PKG_MGR}} dev:e2e &
```

The DB and port are derived from the worktree's basename, so a worktree
named `{{PROJECT_NAME}}-cluster-c` always gets the same DB
(`{{DB_NAME_BASE}}_cluster_c`) and the same port. Tearing down the
worktree does NOT drop the DB — that's intentional, so a worktree you
re-create doesn't have to re-bootstrap.

To drop a worktree DB explicitly:

```sh
psql "$DATABASE_URL_ADMIN" -c 'DROP DATABASE "{{DB_NAME_BASE}}_<suffix>"'
```

---

## Subagent worktrees

When spawning a subagent in a worktree (for example via the Agent tool
with `isolation: "worktree"`), the subagent gets its own checkout AND
its own DB AND its own port — by construction. No coordination needed
between the main session and the subagent.

If the subagent runs `{{PKG_MGR}} test` or `{{PKG_MGR}} test:e2e`, the
wrappers handle isolation. The subagent can start the dev server in
the background without colliding with anything in the parent session.

---

## Troubleshooting

### "Database `{{DB_NAME_BASE}}_X` does not exist"

The wrapper auto-creates on first use. If it didn't:

- Is Postgres running? (`pg_isready`, or `docker compose up -d postgres`)
- Does the role in `DATABASE_URL` have CREATE DATABASE privilege?
- Did the wrapper print a "failed to create" message? Read it.

### Tests pass locally but fail in CI

CI runs against a fresh ephemeral DB and `CI=true` flips the Playwright
config to `webServer` running `{{PKG_MGR}} build && {{PKG_MGR}} start`
instead of `{{PKG_MGR}} dev`. If a spec only fails in CI, it's almost
always one of:

- **Build-time-only error** that `{{PKG_MGR}} dev` swallows but
  `{{PKG_MGR}} build` flags. Run `{{PKG_MGR}} build` locally.
- **Hardcoded baseURL** somewhere in the test code. Use
  `process.env.E2E_BASE_URL`.
- **Race against a missing seed** — the spec assumes data the seed
  doesn't create. Either extend the seed (idempotently) or create the
  data inside the spec.

### Two worktrees collide

They shouldn't. If they do:

- They have the same basename (you ran `git worktree add` to a path
  whose basename collides with another). Rename one.
- The hash function landed on the same port for two different
  basenames in the [{{PORT_LOW}}, {{PORT_HIGH}}) range. Statistically
  unlikely but possible — change one of the worktree names.

### Schema changes aren't picked up

The wrapper hashes the schema file (or `drizzle/` directory) and only
re-pushes when the hash changes. The hash file lives at
`node_modules/.cache/with-worktree-db/<DB>.schema-hash`. Delete it to
force a re-push:

```sh
rm node_modules/.cache/with-worktree-db/{{DB_NAME_BASE}}_*.schema-hash
```
