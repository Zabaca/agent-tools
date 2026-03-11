---
name: pm-status
description: Show the current entity tree and all problems with their links and states.
---

# PM Status

Show the user a clear overview of their problem management database.

**CLI path:** `bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts`

## Step 1: Get the data

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts status
```

## Step 2: Display as a readable summary

Format the output for the user. Don't dump raw JSON — present it in sections.

### Entity tree

```
Zabaca
  ├── James
  └── Process
```

### Problems

For each problem, show:
```
[state] Title
  impact: ...
  opportunity: ...
  → affects: Entity1, Entity2
  → solutions: N proposed, N accepted, N rejected
```

If there are no problems, say "No problems tracked yet. Use /problem to add one."

### Pipeline (active work)

Show pipeline entries grouped by state:

```
In Progress:
  • Solution title (problem: Problem title)

Monitoring:
  • Solution title — outcome: "..."

Done:
  • Solution title — outcome: "..."
```

If the pipeline is empty, say "Nothing in the pipeline."

### Backlog

Show accepted solutions not yet started:

```
Ready to start:
  • Solution title (problem: Problem title)
```

If the backlog is empty, say "Backlog is empty — all accepted solutions are in the pipeline."

## Filtering

If the user asks to filter by state or entity, use:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts problem list --state <state>
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts pipeline list --state <state>
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts pipeline backlog
```
