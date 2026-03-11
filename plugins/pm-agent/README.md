# pm-agent

Problem management as a Claude Code plugin. Capture problems, propose solutions, track execution through a pipeline.

## Data model

```
entities (hierarchical tree)
  └── entity_problems (many-to-many join)
        └── problems (state machine: identified → triaged → in_progress → resolved | wont_fix)
              └── solutions (proposed → accepted | rejected)
                    ├── tasks (pending → in_progress → done, hierarchical)
                    ├── state_transitions (append-only audit log)
                    └── pipeline (execution tracking: in_progress → monitoring → done)
```

**Seven tables**, two concerns:

- **Decision** — problems get solutions, solutions get accepted or rejected (with reasons logged in `state_transitions`)
- **Execution** — accepted solutions enter the `pipeline` for tracking. Accepted solutions with no pipeline entry = backlog.

## Setup

```bash
bun install
```

The database auto-creates on first CLI use at `~/.pm-agent/data.db`. No migration step needed.

## CLI

All commands output JSON. The CLI path is `bun run src/cli.ts`.

### Status

```bash
bun run src/cli.ts status
# Returns: { entities, problems, solutions, tasks, pipeline, backlog }
```

### Entities

```bash
entity list                                    # all entities with parent
entity tree                                    # nested tree from roots
entity add <name> [--parent <id>] [--description "..."]
entity update <id> --name "..." --description "..."
entity find <query>                            # search by name
```

### Problems

```bash
problem list [--state <state>]                 # all problems, optionally filtered
problem get <id>
problem add --title "..." [--description "..."] [--impact "..."] [--opportunity "..."]
problem update <id> --title "..." --impact "..."
problem find <query>                           # search by title
problem transition <id> <EVENT>                # TRIAGE, START, RESOLVE, WONT_FIX, REOPEN
problem link <problem-id> <entity-id>
problem unlink <problem-id> <entity-id>
```

Problem states (XState machine):
```
identified → TRIAGE → triaged → START    → in_progress → RESOLVE  → resolved
                               → WONT_FIX → wont_fix               → REOPEN → triaged
                                                        → WONT_FIX → wont_fix → REOPEN → triaged
```

### Solutions

```bash
solution list [--problem <id>]
solution get <id>
solution add --title "..." --problem <id> [--description "..."]
solution update <id> [--title "..."] [--state accepted|rejected] [--reason "..."]
solution history <id>                          # state transition log
```

Solution states: `proposed` → `accepted` | `rejected` (with reason). State changes are logged in `state_transitions`.

### Tasks

```bash
task list [--solution <id>] [--parent <id>] [--state <state>]
task get <id>
task add --title "..." [--solution <id>] [--parent <id>] [--entity <id>]
task update <id> [--title "..."] [--state <state>] [--entity <id>] [--position <n>]
```

Task states: `pending` → `in_progress` → `done`. Tasks are hierarchical (parent/children).

### Pipeline

Tracks execution of accepted solutions.

```bash
pipeline list [--state <state>]                # all pipeline entries
pipeline backlog                               # accepted solutions not yet started
pipeline start <solution-id>                   # add to pipeline (must be accepted)
pipeline update <solution-id> --state <state> [--outcome "..."]
pipeline get <solution-id>
```

Pipeline states: `in_progress` → `monitoring` → `done`

### Other

```bash
reset                                          # clear all data
```

## Plugin commands

Three skills available as `/slash-commands` in Claude Code:

- `/problem [description]` — guided problem capture with impact, opportunity, entity linking
- `/pm-init [name]` — initialize entity hierarchy for a new user
- `/pm-status` — formatted overview of problems, solutions, pipeline, and backlog

## Stack

- **Bun** + TypeScript
- **Drizzle ORM** + SQLite (`bun:sqlite`)
- **XState** for problem lifecycle state machine
- **Zod** for plugin file validation
