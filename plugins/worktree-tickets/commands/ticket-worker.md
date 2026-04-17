---
description: Spawn a per-ticket teammate that works in its own git worktree, non-blocking
argument-hint: "<ticket-id> <task-description>"
---

# Ticket Worker

Create an isolated worktree rooted on the project's base branch, then spawn a persistent teammate to work the ticket in parallel. Keeps the main session free for discussion.

## Usage

```
/ticket-worker <ticket-id> <task-description>
```

Arguments: `$ARGUMENTS`

## Steps the executor (Claude) should run

1. Parse `<ticket-id>` (first whitespace-separated token of `$ARGUMENTS`) and `<task-description>` (rest).

2. First-run check: look for `.worktree-tickets.json` at the repo root (`git rev-parse --show-toplevel`).
   - If missing, tell the user: *"No `.worktree-tickets.json` found. Want me to create one with defaults for this repo? (y/n)"*
   - On yes, write the file using `${CLAUDE_PLUGIN_ROOT}/scripts/init-config.sh`:
     ```bash
     bash "${CLAUDE_PLUGIN_ROOT}/scripts/init-config.sh"
     ```
     The script autodetects the repo basename, writes sensible defaults, and adds the file to `.gitignore` if the user opts to keep secrets-adjacent settings out of git. If you want to edit before proceeding, show the user the resulting file and pause for confirmation.
   - On no, continue with built-in defaults for this run.

3. Create the worktree and bootstrap it:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/new-ticket-worktree.sh" <ticket-id>
   ```
   The script reads optional `.worktree-tickets.json` at the project root for overrides (base branch, seed files, post-create install commands). It prints the worktree path on the final stdout line.

4. Determine the team name and ensure it exists.
   - Default: `tickets-<repo-slug>` where `<repo-slug>` = basename of `git rev-parse --show-toplevel`
   - Override: if `.worktree-tickets.json` has a `team_name` field, use that
   - **Do not use a bare `tickets`** — teams are user-global, so a generic name will collide across projects and leak messages between sessions.
   ```
   TeamCreate(team_name="<team-name>", agent_type="team-lead", description="Per-ticket workers for <repo-slug>")
   ```
   If it already exists, skip.

5. Spawn the teammate. Use the ticket id as the teammate name so it's addressable by `SendMessage`:
   ```
   Agent({
     subagent_type: "general-purpose",
     team_name: "<team-name>",
     name: "<ticket-id>",
     prompt: <see template below>
   })
   ```

## Teammate prompt template

```
You are teammate "<ticket-id>" in team "<team-name>".

Workspace: <worktree-path>   (pre-created, env + deps seeded)
Branch:    <branch-name>     (rooted on <base-branch>)

Always `cd` to the workspace before running commands. Do not modify files outside it.

Task:
<task-description>

Workflow:
- Investigate + plan before editing.
- When you pause or finish a subtask, SendMessage to "team-lead" with: what you did, what's blocking you (if anything), what you'll do next.
- Go idle between messages — the team lead may redirect or approve next steps.
- Do not push branches or open PRs unless explicitly asked.
```

## Configuration

Optional `.worktree-tickets.json` at the project root:

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

All keys are optional; defaults above.

## Operator tips

- Teammates auto-deliver messages as new turns — no polling.
- Redirect mid-work: `SendMessage(to: "<ticket-id>", message: "...")`.
- Shut down: `SendMessage(to: "<ticket-id>", message: {type: "shutdown_request", reason: "..."})`.
- Clean up after shutdown: `git worktree remove <path>` (or `--force` if needed).
