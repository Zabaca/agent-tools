# worktree-tickets

Create per-ticket git worktrees for Claude Code, pre-seeded with env files and bootstrapped with install commands. Includes a direnv-aware Bash hook.

## What it does

1. **`new-worktree` skill** (invoke via `/new-worktree <id>` or just ask) — creates a fresh worktree at `../stack-<id>` on branch `ticket/<id>` (rooted on `origin/main`), seeds gitignored `.env` files, and runs configured post-create commands. You `cd` into it from the main session and work there.

2. **`PreToolUse` Bash hook** — if an `.envrc` is present at or above the session cwd, auto-wrap Bash commands with `direnv exec` so vars load even in non-interactive shells. Pure `cd <path>` commands pass through unwrapped so the harness can persist cwd.

## Install

```
/plugin marketplace add Zabaca/agent-tools
/plugin install worktree-tickets@zabaca-agent-tools
```

## Configuration

Create `.worktree-tickets.json` at the project root (all keys optional; the skill will offer to scaffold it on first run):

```json
{
  "base_branch": "main",
  "worktree_parent": "..",
  "worktree_prefix": "stack-",
  "branch_prefix": "ticket/",
  "seed": [".env"],
  "direnv_allow": true,
  "post_create": [
    { "dir": "packages/dbt", "cmd": "uv sync" },
    { "dir": "packages/evidence", "cmd": "npm install" }
  ]
}
```

## Dependencies

- `git` (required)
- `jq` (required for config parsing)
- `direnv` (optional — enables the Bash wrapper hook; without it, the hook is a no-op)

## Why no team/subagent spawning?

An earlier version of this plugin spawned a per-ticket teammate pointed at each worktree. That approach is blocked by a Claude Code harness limitation: **subagent Bash sessions do not persist cwd across calls** — a standalone `cd` is reverted on the next command. See [anthropics/claude-code#12748](https://github.com/anthropics/claude-code/issues/12748). Until that lands, the only reliable path is to work inside the worktree from the main session.
