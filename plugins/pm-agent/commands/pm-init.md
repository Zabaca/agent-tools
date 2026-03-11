---
name: pm-init
description: Initialize pm-agent for a new user. Sets up your entity hierarchy (org, teams, areas) and clears sample data.
argument-hint: "[your name or org name]"
---

# PM Agent Setup

You are initializing the problem management database for a new user. Your job is to create their entity hierarchy so they can start tracking problems.

**CLI path:** `bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts`

## Step 1: Check current state

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts entity tree
```

If the tree is empty, skip to Step 2.

If sample data exists (Acme Corp, etc.), tell the user you'll replace it during setup.

If real data exists, ask the user if they want to reset or add to what's there.

## Step 2: Gather info

If the user provided their name or org in $ARGUMENTS, use it as the root entity name. Otherwise ask:

- "What's your name or organization name?" — this becomes the root entity
- "What areas do you want to track problems against?" — these become child entities

Suggest examples:
- Solo dev: `James > Frontend, Backend, DevOps, Marketing`
- Team: `Acme > Engineering, Product, Sales, Support`
- Project: `MyApp > Auth, Dashboard, API, Mobile`

Keep it simple — they can always add more later with `/problem`.

## Step 3: Create entities

If replacing existing data, reset first:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts reset
```

Create the root entity:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts entity add "<root name>"
```

Create child entities using the root's ID from the output above:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts entity add "<child name>" --parent "<root-id>"
```

Repeat for each area the user mentioned.

## Step 4: Confirm

Show the final tree:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts entity tree
```

Tell the user:
- They're set up
- Use `/problem` to capture a new problem
- They can add more entities anytime with `/problem` (it offers to create new ones during linking)

## Step 5: Config info

Show the resolved config:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts config show
```

Tell the user:
- Where their DB is stored (from the config show output)
- To create a project-level DB: `config init` from the project directory
- To switch to Turso: `config set --url "libsql://..." --auth-token "..."`
