---
name: new-worktree
description: Create an isolated git worktree rooted on the project's base branch, pre-seeded with env files and bootstrapped with install commands. Use when the user wants to start work on a new ticket, feature, or experiment in an isolated workspace — or invokes `/new-worktree <ticket-id>`.
user-invocable: true
argument-hint: "<ticket-id>"
---

# New Worktree

Provisions a git worktree at `<worktree_parent>/<worktree_prefix><ticket-id>` on branch `<branch_prefix><ticket-id>`, rooted on the configured base branch. Copies seed files (e.g. `.env`), runs `direnv allow` if configured, and executes any `post_create` install commands.

Once created, the user can `cd` into the worktree from the **main session** and work there directly. Subagent/team-member Bash sessions do NOT persist cwd (harness limitation — see `anthropics/claude-code#12748`), so this skill intentionally does not spawn teammates.

## Steps

1. Parse `<ticket-id>` from the argument. If none provided, ask the user for one.

2. First-run check: look for `.worktree-tickets.json` at the repo root (`git rev-parse --show-toplevel`).
   - If missing, ask: *"No `.worktree-tickets.json` found. Create one with defaults for this repo? (y/n)"*
   - On yes:
     ```bash
     bash "${CLAUDE_PLUGIN_ROOT}/scripts/init-config.sh"
     ```
   - On no, continue with built-in defaults.

3. Create the worktree:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/new-ticket-worktree.sh" <ticket-id>
   ```
   The script reads `.worktree-tickets.json` for overrides (base branch, seed files, post-create install commands). It prints the worktree path on the final stdout line.

4. Report to the user:
   - Worktree path
   - Branch name
   - Suggest `cd <worktree-path>` to start working

## Configuration

Optional `.worktree-tickets.json` at the project root:

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

All keys optional; defaults above.

## Cleanup

When the ticket is done:
```bash
git worktree remove <worktree-path>      # or --force if dirty
git branch -D <branch-name>              # if branch no longer needed
```
