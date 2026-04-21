---
name: orchestrator
description: Spawn a long-lived `builder` teammate in the current worktree so the orchestrator (this session) keeps a clean context during multi-round design + implementation work. The builder absorbs file reads, tool output, and verification runs. Use when the user invokes `/orchestrator [plan-file]`, or asks to set up a builder / two-agent workflow.
user-invocable: true
argument-hint: "[plan-file]"
---

# Orchestrator

Multi-round design + implementation sessions fill the main context window with tool results and file contents, triggering compaction that cuts into still-relevant design state. This skill introduces a load-bearing seam: **the orchestrator (you, this session) holds design state; the builder teammate holds implementation state**. All file reads, edits, and verification happen in the builder's context. Round-trip via `SendMessage`.

The builder is long-lived — subsequent tasks reuse it, so follow-ups don't re-spawn. It works in the **same worktree** as the orchestrator (this skill does not create worktrees).

## Steps

1. **Derive team name.** Run:
   ```bash
   basename "$(git rev-parse --show-toplevel)"
   ```
   Team name is `builder-<repo-slug>`. Do NOT use a bare `builder` — teams are user-global by name and would collide across projects.

2. **Resolve worktree path.** Run `git rev-parse --show-toplevel` to get the absolute path. The builder must `cd` there for every Bash call because subagent Bash sessions do not persist cwd (anthropics/claude-code#12748).

3. **Parse `$ARGUMENTS`.** If non-empty, treat as a plan file path. Resolve to absolute (`realpath "$ARGUMENTS"` or equivalent). It becomes the authoritative spec passed to the builder's brief. If empty, skip the plan-file line in the brief.

4. **Ensure the team exists:**
   ```
   TeamCreate(
     team_name: "builder-<repo-slug>",
     agent_type: "team-lead",
     description: "Long-lived builder for <repo-slug>"
   )
   ```
   If it already exists, skip silently.

5. **Spawn the builder.** Use the exact brief in the next section:
   ```
   Agent({
     subagent_type: "general-purpose",
     team_name: "builder-<repo-slug>",
     name: "builder",
     prompt: <brief below>
   })
   ```

6. **Report to user.** One concise line: team name, worktree path, plan file (if any), and how to dispatch work:
   ```
   SendMessage(to: "builder", message: "<task>")
   ```

## Builder brief template

Pass this verbatim, with placeholders filled. Omit the `Plan file:` line and the plan-reading sentence in `## First task` if no plan file was provided.

```
You are teammate "builder" in team "builder-<repo-slug>".

Workspace: <abs-worktree-path>
Plan file: <abs-plan-path>

## cwd handling
Subagent Bash sessions do NOT persist cwd across calls
(anthropics/claude-code#12748). For every Bash call, either:
  - prefix with `cd <abs-worktree-path> && ...`, or
  - use absolute paths.
Never rely on a prior `cd` having stuck.

## Execution
Execute for real. Edit files, run tests, run migrations — do not just
describe what you would do. If a step is destructive or touches shared
state (git push, PR open, schema drop, package publish), confirm with
the orchestrator (team-lead) first.

## Reporting
When you finish a task or get blocked, SendMessage to "team-lead" with
a TERSE structured report — done / blocked / next. No raw logs, no
file dumps, no tool-result transcripts. Summarize. If the orchestrator
needs a specific excerpt, they will ask.

## Idle discipline
Go idle between messages. Do not anticipate follow-up work. The
orchestrator will redirect or approve next steps.

## First task
Read the plan file and acknowledge with a 1–3 sentence summary of what
you understand the job to be, plus the first concrete step you intend
to take. Wait for the orchestrator to confirm before executing.
```

## Sending work

- Dispatch: `SendMessage(to: "builder", message: "<task>")`. Each message is a new turn for the builder.
- Redirect mid-work: another `SendMessage` — the builder will interrupt after its current step.
- Receive reports as inbound turns; react in the orchestrator (this) session.

## Cleanup

Teardown is user-initiated. Two options:

- **Soft:** `SendMessage(to: "builder", message: { type: "shutdown_request", reason: "..." })`
- **Hard:** `TeamDelete(team_name: "builder-<repo-slug>")`

## Re-invocation

If `/orchestrator` is invoked a second time in the same session, step 4's `TeamCreate` no-ops and step 5 reuses the existing `builder`. Pass a fresh plan file via the argument if the job has changed.
