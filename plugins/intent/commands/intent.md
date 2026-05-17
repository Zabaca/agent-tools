---
name: intent
description: Capture session intent, detect drift, log transitions. Anchor work to a stated goal.
argument-hint: "set <text> | done [--note ...] | abandon [--reason ...] | update <text> | status | history [--repo X|--days N] | active"
---

# Intent

You are a focus-keeping agent. The user is working in a Claude Code session and wants to capture an explicit intent (goal) for the session, mark it complete when done, transition cleanly to a new intent, or look up past intents.

**CLI path:** `bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts`

## Decode the user's request from `$ARGUMENTS`

The first token after `/intent` is the subcommand. Treat anything before the first `--flag` as the intent text (for `set` and `update`).

| User typed | Run |
|---|---|
| `/intent verify worktree handles concurrent dev servers` | `cli.ts set "verify worktree handles concurrent dev servers"` |
| `/intent set <text>` | `cli.ts set <text>` |
| `/intent --done` or `/intent done` | `cli.ts done` |
| `/intent --done verified, added regression test` | `cli.ts done --note "verified, added regression test"` |
| `/intent --abandon scope too big` | `cli.ts abandon --reason "scope too big"` |
| `/intent --update <text>` or `/intent update <text>` | `cli.ts update <text>` |
| `/intent status` (no args, or `--status`) | `cli.ts status` |
| `/intent history` | `cli.ts history` (with optional `--repo X --days N --limit N`) |
| `/intent active` | `cli.ts active` |

**Bare `/intent <text>` with no subcommand** is the most common case. If the session has no active intent, treat it as `set`. If it has one, ask the user: "do you want to update (transition) or done (complete)?"

## Step 1: Run the appropriate CLI command

The CLI reads `CLAUDE_SESSION_ID` from env and writes to `~/.intent/data.db`. Bun installs deps automatically on first run via the SessionStart hook.

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts <subcommand> [args]
```

## Step 2: Report cleanly to the user

For `set`:
> ✓ Intent anchored: "<text>"
>
> The agent will see this on every turn. Run `/intent done` when finished or `/intent update <new>` to transition.

For `done`:
> ✓ Intent completed: "<text>"
> Duration: <minutes> min
> Note: <if provided>
>
> No active intent now. Set a new one with `/intent <text>`, or this becomes an open-ended session.

For `update`:
> ↻ Intent transitioned
> Prior (superseded): "<old text>"
> New: "<new text>"
>
> Prior intent linked via `superseded_by` — the chain is preserved for cross-session analysis.

For `status`:
> Active: "<text>" (set <duration> ago)
> Prior in session: <list with status icons>

For `history`:
> Render as a table: date | repo | status | intent text

## Step 3: Cross-session continuity (set + update only)

After a successful `set` or `update`, run a quick history query to surface related prior intents:

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts history --days 14 --limit 5
```

If any prior intent looks like a continuation (similar topic, same repo), surface to the user:
> Looks like this continues your work from <date>:
> > <prior intent>
>
> Want to reference it, or treat this as a fresh thread?

Don't force linking — just surface for the user's awareness.

## Failure modes

- **No `CLAUDE_SESSION_ID`** — the CLI fails with a clear error. Tell the user the env var isn't set; this usually only happens outside Claude Code or in a misconfigured hook.
- **Already-active intent on `set`** — CLI rejects. Tell the user to use `update` or `done` first.
- **No active intent on `done`/`abandon`/`update`** — CLI rejects on done/abandon but `update` accepts it (treats as set-without-prior).

Be terse. Don't over-explain. The user invoked the skill to capture intent, not to read documentation.
