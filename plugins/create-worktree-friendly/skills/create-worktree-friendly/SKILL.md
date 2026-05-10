---
name: create-worktree-friendly
description: Bootstrap a repo for parallel-safe git-worktree development. Generates per-worktree DB + dev/e2e port wrappers, a Playwright e2e scaffold (config, globalSetup, fixtures, CI workflow), package.json scripts that compose the wrappers, and a project-local `worktree` skill that documents the full setup. Use when a repo has no parallel-worktree story and you want subagents to be able to run dev servers, tests, and e2e specs concurrently without colliding on ports or databases.
user-invocable: true
argument-hint: "[--dry-run]"
---

# Create Worktree-Friendly

Bootstraps a repo so that any number of git worktrees can run dev servers, tests, and e2e specs in parallel without colliding. The pattern, proven in `dotmcs`:

- **`scripts/with-worktree-db.sh`** — derives a per-worktree Postgres DB name from `basename(toplevel)`, auto-creates it, applies the schema (tool-aware: Prisma / Drizzle), and execs the wrapped command with the right `DATABASE_URL`.
- **`scripts/with-worktree-port.sh`** — hashes `basename(toplevel)` into a port range and exports `PORT` + `E2E_BASE_URL` + `E2E_MODE=1`.
- **`e2e/`** — Playwright config that wires `webServer` to the wrapper-derived port + globalSetup that's a no-op when the DB wrapper already bootstrapped the schema.
- **`.github/workflows/e2e.yml`** — CI gate so the smoke runs on every PR.
- **`.claude/skills/worktree/SKILL.md`** — the project-local guide that future agents read to understand how to use this kit.

The meta-skill auto-detects the project's stack and asks only when a value can't be inferred. It does not write ADRs (deliberate — the user opted out) and it does not modify application code (e.g., no payment-route shim — that's a pattern the generated `worktree` skill teaches the user to apply themselves).

---

## Workflow

### 1. Detect the stack

Read these files (skip silently if missing):

```
package.json           — pkg manager, dev script, name, existing test scripts
prisma/schema.prisma   — Prisma users
drizzle.config.*       — Drizzle users
docker-compose.yml     — DB host/port hints
.env.test / .env.example / .env.local — DATABASE_URL pattern
playwright.config.*    — already has Playwright?
.github/workflows/     — has a test.yml to mirror?
scripts/with-worktree-db.sh  — already done? If so, abort with a note.
```

Resolve these variables:

| Var | How to derive |
|---|---|
| `PROJECT_NAME` | `package.json` `name`, fallback `basename(toplevel)` |
| `PKG_MGR` | `pnpm-lock.yaml` → `pnpm`; `bun.lockb` → `bun`; `yarn.lock` → `yarn`; default `npm` |
| `DEV_CMD` | `<pkg_mgr> dev` if `scripts.dev` exists, else ask |
| `DB_TOOL` | `prisma`, `drizzle`, or `none` |
| `DB_NAME_BASE` | parse the `/<dbname>` segment from `DATABASE_URL` in `.env.test`. If `.env.test` missing, ask. The wrapper's worktree DB names will be `${DB_NAME_BASE}_<suffix>`. |
| `ENV_TEST_FILE` | `.env.test` if present, else `.env.example`, else ask |
| `PORT_LOW`, `PORT_HIGH` | default 3100–3499. Ask only if a comment or config suggests a different range. |
| `DEV_PORT` | from `package.json` `scripts.dev` (`-p NNNN` flag) or framework default (Next.js → 3000) |
| `HAS_E2E` | `e2e/` exists or `playwright` is in deps |

When a value is genuinely ambiguous, ask. Do not ask for values that are clearly inferable — that's noise.

### 2. Confirm the plan

Print a one-screen summary of the files that will be created/modified and the resolved variables. Get a yes before writing.

If `--dry-run` was passed, print the plan and exit without writing.

### 3. Write the files

Templates live next to this SKILL.md under `templates/`. Substitute `{{VAR}}` placeholders using the resolved variables, then write to the target paths below. Use the Write tool, not shell `cat`/`echo`.

| Template | Target path | When to write |
|---|---|---|
| `templates/with-worktree-db.prisma.sh` | `scripts/with-worktree-db.sh` | `DB_TOOL=prisma` |
| `templates/with-worktree-db.drizzle.sh` | `scripts/with-worktree-db.sh` | `DB_TOOL=drizzle` |
| `templates/with-worktree-db.none.sh` | `scripts/with-worktree-db.sh` | `DB_TOOL=none` (passthrough) |
| `templates/with-worktree-port.sh` | `scripts/with-worktree-port.sh` | always |
| `templates/playwright.config.ts` | `e2e/playwright.config.ts` | always |
| `templates/globalSetup.ts` | `e2e/globalSetup.ts` | always |
| `templates/fixtures-test.ts` | `e2e/fixtures/test.ts` | always |
| `templates/e2e.yml` | `.github/workflows/e2e.yml` | always |
| `templates/worktree-skill.md` | `.claude/skills/worktree/SKILL.md` | always |

`chmod +x` the two `scripts/with-worktree-*.sh` files after writing.

If a target file already exists, show a diff and ask before overwriting. Never silently clobber.

### 4. Patch `package.json`

Add to `devDependencies` (latest stable):

```
@playwright/test
```

Add (or update — preserve any existing) to `scripts`:

```json
{
  "test:e2e": "./scripts/with-worktree-port.sh ./scripts/with-worktree-db.sh playwright test --config e2e/playwright.config.ts",
  "test:e2e:ui": "./scripts/with-worktree-port.sh ./scripts/with-worktree-db.sh playwright test --config e2e/playwright.config.ts --ui",
  "test:e2e:codegen": "./scripts/with-worktree-port.sh playwright codegen $E2E_BASE_URL",
  "dev:e2e": "./scripts/with-worktree-port.sh {{PKG_MGR}} dev -p $PORT"
}
```

If existing `test` / `test:watch` scripts directly invoke a test runner (e.g. `vitest`, `jest`), wrap them with `./scripts/with-worktree-db.sh` so the canonical `<DB_NAME_BASE>` keeps working in the main checkout and worktrees branch onto their own DB. Show the diff and confirm before applying — wrapping the existing test command is the highest-value, highest-blast-radius change in this skill.

### 5. Final steps

1. Run `<PKG_MGR> install` to pull in `@playwright/test`.
2. Run `<PKG_MGR> exec playwright install chromium` to install the browser binary.
3. Print a "next steps" block explaining:
   - Try `<PKG_MGR> test:e2e` to verify the wrapper round-trips.
   - Add the first smoke spec under `e2e/specs/` — point at the project-local `/worktree` skill for the authoring loop.
   - Mark `e2e.yml` as a required check in branch protection once the first smoke is green.

---

## Guidelines

- **Don't write ADRs.** The user opted out — don't invent a hypothetical ADR section.
- **Don't modify application code.** No payment-route shim, no API edits. The generated `worktree` skill teaches the `E2E_MODE` shim pattern; the user applies it themselves to their hot-path routes.
- **Don't fabricate `DATABASE_URL`s.** If `.env.test` is missing, ask — silently writing a wrong default makes the wrapper fail in a confusing way.
- **Preserve existing scripts.** Wrap, don't replace. If `test` already runs `vitest run`, the new value is `./scripts/with-worktree-db.sh vitest run`.
- **Atomic writes.** Either the whole bundle lands, or none of it. If any step fails partway, list what was written so the user can clean up.
- **Idempotent re-runs.** If the user runs the skill again, detect already-present files and offer to update them rather than fail.
- **Verification before exit.** After writing, suggest one command (`<PKG_MGR> test:e2e --list` or similar) the user can run to confirm the wrappers don't blow up.

---

## What this skill does NOT do

- Does not author specific e2e specs. The first smoke is project-specific (which form? which happy path?) — that's a follow-up handled by the project-local `worktree` skill, which knows about the Playwright MCP authoring loop.
- Does not touch CI branch-protection settings (those are GitHub UI / API concerns, not file generation).
- Does not write ADRs.
- Does not modify application routes or add hermetic shims to payment / email / external-API paths.
- Does not generate dev-start, db-restore, or other onboarding skills — use `create-dev-start` separately for those.
