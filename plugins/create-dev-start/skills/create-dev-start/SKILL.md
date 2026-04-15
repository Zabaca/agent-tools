---
name: create-dev-start
description: Analyzes the current project and generates a dev-start skill that guides new developers through local environment setup. Use when the user wants to create onboarding docs or a dev setup guide.
user-invocable: true
argument-hint: "[--dry-run]"
---

# Create Dev Start Skill

Analyzes the current project's stack, dependencies, database, and configuration to generate a tailored `dev-start` skill at `.claude/skills/dev-start/SKILL.md`.

## Workflow

### 1. Detect Project Stack

Read these files (if they exist) to understand the project:

```
package.json          — runtime, scripts, dependencies
Cargo.toml            — Rust project
pyproject.toml        — Python project
go.mod                — Go project
docker-compose.yml    — containerized services
.env.example / .env*  — required environment variables
CLAUDE.md             — project context and conventions
README.md             — existing setup docs
```

Determine:
- **Language & runtime**: Node/Bun/Deno, Python, Go, Rust, etc.
- **Package manager**: npm, yarn, pnpm, bun, pip, cargo, etc.
- **Framework**: Next.js, Remix, Django, Rails, FastAPI, etc.
- **Database**: Postgres, MySQL, SQLite, MongoDB, Redis, etc.
- **ORM/migrations**: Prisma, Drizzle, Alembic, ActiveRecord, etc.
- **Dev port**: from scripts or config
- **Required services**: Docker, external APIs, etc.
- **Environment variables**: from .env.example or .env*.local patterns

### 2. Detect Database Setup

Look for migration/seed patterns:

```
drizzle/              — Drizzle migrations
prisma/               — Prisma schema + migrations
migrations/           — Generic migrations folder
scripts/migrate*      — Migration scripts
scripts/seed*         — Seed scripts
docker-compose.yml    — Database containers
```

Determine:
- How to create/migrate the database
- Whether seeding is available and what it does
- Whether a local DB is sufficient or external services are needed

### 3. Detect Environment Setup

```
.env.example          — Template env vars
.env.local            — Local overrides (gitignored)
vercel.json           — Vercel config
netlify.toml          — Netlify config
```

Determine:
- Which env vars are required vs optional
- How to obtain credentials (e.g., `vercel env pull`)
- Which are needed for local dev vs only for prod

### 4. Detect Verification Steps

From `package.json` scripts or framework conventions, identify:
- How to start the dev server
- What URL/port to check
- API endpoints to smoke test
- Test commands to run

### 5. Generate the Skill

Create `.claude/skills/dev-start/SKILL.md` with this structure:

```markdown
---
name: dev-start
description: Sets up a local dev environment for [project name]. Use when a new developer needs to get the project running.
user-invocable: true
---

# Dev Start — [Project Name]

Gets a new developer from zero to a running local dev environment.

## Workflow

### 1. Prerequisites Check
[Required tools with version checks and install instructions]

### 2. Install Dependencies
[Package install command with troubleshooting]

### 3. Environment Setup
[.env file setup — what to copy, what credentials to obtain]

### 4. Database Setup
[Migration and seed commands, local vs external DB]

### 5. Start Dev Server
[Commands to start long-running services using Bash with `run_in_background: true`.
Include a health check (e.g., curl) after a short wait to verify the server is responding.
Include port conflict handling (lsof + kill) in case a prior instance is still running.]

### 6. Verify Everything Works
[Checklist of what to check + API smoke tests]

## Project Overview
[Table: framework, runtime, database, styling, deployment, dev port]

## Key Commands
[Table: command → purpose for common dev tasks]

## Troubleshooting
[Common issues and fixes discovered during analysis]
```

### 6. Output

- If `--dry-run` is passed, print the generated skill to the console without writing it
- Otherwise, write to `.claude/skills/dev-start/SKILL.md`
- If the file already exists, show a diff and ask before overwriting

## Guidelines

- **Be specific**: Use actual commands, ports, URLs from the project — not generic placeholders
- **Be complete**: A developer with zero project context should be able to follow the steps
- **Be honest**: If something requires manual steps (e.g., obtaining API keys), say so clearly
- **Warn about destructive commands**: Flag any seed/reset commands that wipe data
- **Include smoke tests**: Always add at least one curl or CLI check to verify the setup works
- **Keep it maintainable**: Reference scripts from package.json rather than inlining complex commands
- **Run long-running processes in background**: Dev servers, job runners, webhook listeners, and similar long-running processes must use `run_in_background: true` on Bash tool calls. Follow up with a health check (e.g., `sleep 5 && curl -sf -o /dev/null -w "%{http_code}" http://localhost:<port>`) to verify they started. Include port conflict handling (`lsof -ti:<port> | xargs kill`) before starting.
- **Symlink .env for Prisma**: If the project uses Prisma, note that Prisma reads `.env` not `.env.local` — include `ln -sf .env.local .env` in the env setup step
