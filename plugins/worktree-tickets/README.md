# worktree-tickets

Per-ticket git worktrees + parallel teammates for Claude Code. Spawn isolated ticket workers from a main session without blocking.

## What it does

1. **`/ticket-worker <id> <task>`** — creates a fresh worktree at `../stack-<id>` on branch `ticket/<id>` (rooted on `origin/main`), seeds gitignored `.env` files, runs configured post-create commands, and spawns a persistent teammate named `<id>` pointed at that worktree.

2. **`WorktreeCreate` hook** — when a subagent is spawned with `isolation: "worktree"`, create the git worktree and seed env files so the subagent inherits dev credentials.

3. **`PreToolUse` Bash hook** — if an `.envrc` is present at or above the session cwd, auto-wrap Bash commands with `direnv exec` so vars load even in non-interactive shells.

## Install

```
/plugin marketplace add Zabaca/agent-tools
/plugin install worktree-tickets@zabaca-agent-tools
```

## Configuration

Create `.worktree-tickets.json` at the project root (all keys optional):

```json
{
  "base_branch": "main",
  "team_name": "tickets-myrepo",
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

**`team_name` default:** `tickets-<basename of repo root>`. Teams are user-global by name, so bare `tickets` would collide across projects. Override via `team_name` if you want a specific name.

## Dependencies

- `git` (required)
- `jq` (required for config parsing — install via your package manager)
- `direnv` (optional — enables the Bash wrapper hook; without it, the hook is a no-op)

## Limitations

- `isolation: "worktree"` is ignored for **team** teammates (confirmed via Anthropic docs). This plugin works around that by pre-creating worktrees via `/ticket-worker` so teammates can be directed into them.
- Bootstrap hook output is parsed by Claude Code as the worktree path — do not modify the final `echo "$DST"` line of `bootstrap-worktree.sh`.
