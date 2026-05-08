# red-sweep

Hook-enforced TDD issue discovery for Claude Code. Find bugs, security holes, and code-quality issues by writing failing tests that prove the problems exist — with a state-machine hook that prevents drift.

## How it works

A small state machine, enforced by Claude Code hooks (`scripts/state-machine.ts`, run via Bun):

| State | What's allowed |
|-------|----------------|
| **INIT** | Everything. Agent interviews user, writes `.red-sweep/state.json`. |
| **DISCOVERING** | Read/Grep/Glob freely. Bash for read-only commands. Write/Edit ONLY on test files. Each test write must add exactly one test, and the test must fail. |
| **FILING** | Only filing actions: `gh issue create` or edits to the configured findings markdown. |

Stop is gated: while `finding_count == 0`, Stop is blocked up to `loop_limit` attempts (default 10), then allowed.

## Why a state machine?

Prompt-only TDD drifts. The model batches tests, sneaks in source fixes, or commits half-green. Hooks deny the tool call before the model can rationalize around it.

## Usage

```
/red-sweep <scope> <focus-area>
```

The skill drops you into INIT. Confirm test framework, test patterns, and issue tracker with the user, then state.json is written and hooks take over.

## State file

`.red-sweep/state.json` — single source of truth. Configure `test_cmd_single`, `test_pattern`, `test_dir`, `test_marker_regex`, `tracker` (+ `findings_file` if markdown), `focus`, `scope`, `loop_limit`. See SKILL.md for the full schema.

## Files

```
plugins/red-sweep/
├── .claude-plugin/plugin.json
├── skills/red-sweep/SKILL.md       # INIT instructions + state docs + hooks frontmatter
├── scripts/state-machine.ts        # Single hook entrypoint (PreToolUse/PostToolUse/Stop), run with Bun
└── README.md
```

## Requirements

- [Bun](https://bun.sh) on `PATH` — the hooks invoke `bun scripts/state-machine.ts <event>`.
