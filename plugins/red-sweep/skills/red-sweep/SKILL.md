---
name: red-sweep
description: TDD-based issue discovery, hook-enforced. Use when user wants to find bugs, security holes, or code quality issues by writing failing tests that prove problems exist. Triggers: "red sweep", "find issues", "audit this", "probe for bugs", "security audit", "find vulnerabilities".
user-invocable: true
argument-hint: "<scope> <focus-area>"
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "bun ${CLAUDE_SKILL_DIR}/scripts/state-machine.ts pre-write"
          timeout: 30
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bun ${CLAUDE_SKILL_DIR}/scripts/state-machine.ts pre-bash"
          timeout: 30
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "bun ${CLAUDE_SKILL_DIR}/scripts/state-machine.ts post-write"
          timeout: 60
  Stop:
    - hooks:
        - type: command
          command: "bun ${CLAUDE_SKILL_DIR}/scripts/state-machine.ts stop"
          timeout: 10
---

# Red Sweep

TDD-based issue discovery, enforced by a state-machine hook. The agent's job is to do **INIT** with the user; from then on, hooks (`scripts/state-machine.ts`, run with `bun`) enforce the discipline so the agent can't drift.

**Runtime requirement:** [Bun](https://bun.sh) on `PATH`. The hooks shell out to `bun scripts/state-machine.ts ...`.

## State machine

```
INIT  ──(state.json written)──▶  DISCOVERING ◀──┐
                                     │          │
                                  red test       file finding
                                  written        (issue or md)
                                     │          │
                                     ▼          │
                                  FILING ───────┘

(Stop is gated: blocked while finding_count == 0, until loop_limit attempts.)
```

State lives in `.red-sweep/state.json` at the project root. The hook script reads it on every tool call.

## Phase 1 — INIT (your job; no enforcement yet)

While `state.json` does not exist, hooks allow everything. Use this window to interview the user and detect the project conventions, then write `state.json`.

Detect, propose, and confirm with the user:

- **`test_cmd_full`** — full-suite command (e.g. `npx vitest run`, `pytest`, `go test ./...`).
- **`test_cmd_single`** — single-file command with a `{file}` placeholder (e.g. `npx vitest run {file}`, `pytest {file}`).
- **`test_pattern`** — basename glob (e.g. `*.test.ts`, `*.spec.ts`, `test_*.py`).
- **`test_dir`** — directory tests live under (e.g. `test`, `__tests__`, `tests`). Empty string = no dir constraint.
- **`test_marker_regex`** — regex that matches one test declaration. Defaults: JS-ish `^\s*(it|test)\s*\(`, Python `^\s*def test_`. Used to count tests in a file (baseline vs after-write).
- **`tracker`** — `"github"` (uses `gh issue create`) or `"markdown"`.
- **`findings_file`** — only if `tracker == "markdown"` (e.g. `RED-SWEEP.md`).
- **`focus`** — what to look for: security, correctness, perf, race conditions, input validation, etc. User-defined.
- **`scope`** — codebase / specific files / PR / commit.
- **`loop_limit`** — max Stop attempts allowed with zero findings before Stop is permitted (default `10`).

Initial values to also write:

```json
{
  "state": "DISCOVERING",
  "finding_count": 0,
  "stop_attempts": 0,
  "current_test": "",
  "baseline_test_count": 0,
  "pending_test_file": ""
}
```

Once you write `state.json` with `state: "DISCOVERING"`, the hooks take over.

## Phase 2 — DISCOVERING (hook-enforced)

What hooks allow:

- Read, Grep, Glob — unrestricted.
- Bash — read-only commands. **Blocked:** `git commit`, `git push`, `git reset`, `git checkout`, `git rebase`, `git merge`, `rm`.
- Write/Edit — **only test files** (basename matches `test_pattern` AND path under `test_dir`).

What the post-write hook checks on every test write:

1. Was a new test added? (delta of `test_marker_regex` matches must be exactly **+1**.)
2. Does the new test **fail**? (Runs `test_cmd_single` with `{file}` substituted; non-zero exit required.)

If yes to both, state transitions to **FILING** and `current_test` is locked to that file. You then have to file before doing anything else.

Failure modes the hook will surface back to you:

- "Only test files may be edited" — you tried to fix source while red. Don't.
- "Already a red test that hasn't been filed" — you tried to write a second test before filing the first.
- "Did not add a new test" / "added N tests" — write exactly one test per cycle.
- "Tests pass" — your red test isn't actually red. A passing test proves nothing.

## Phase 3 — FILING (hook-enforced)

What hooks allow:

- If `tracker == "github"`: `gh issue create ...`.
- If `tracker == "markdown"`: Write/Edit on `findings_file` only.

On a successful filing action, the hook increments `finding_count`, clears `current_test`, and transitions back to **DISCOVERING**.

Everything else — source edits, more test files, `git commit` — is blocked.

## Stop gating

The Stop hook checks `finding_count`:

- `> 0` → stop allowed.
- `== 0` and `stop_attempts < loop_limit` → stop blocked, attempts incremented.
- `== 0` and `stop_attempts >= loop_limit` → stop allowed (you genuinely found nothing).

## Why hooks, not prompt discipline

Prompt-only TDD drifts: you batch tests, you sneak fixes in, you commit half-green. Hooks make the rules unforgeable — the harness denies the tool call before the model can rationalize around it.

Phase 2 (the actual fix-each-finding work) lives outside this skill. After discovery, the agent (or a separate session) opens each filed finding and fixes it one at a time.
