# red-sweep

TDD-based issue discovery for Claude Code. Find bugs, security holes, and code quality issues by writing failing tests that prove problems exist — then fix them one at a time.

## How it works

**Phase 1 — Red Sweep (discovery).** You give a scope (codebase, file, PR, commit) and a focus area (security, correctness, perf, etc.). The skill scans broadly and, for each issue it suspects, writes ONE failing test that proves the issue exists, then files the finding. No fixes during discovery — the red tests are the exploration tool.

**Phase 2 — Vertical fix.** Pick one finding. Write the minimal fix to turn its test green. Commit. Move to the next. One finding, one fix, one commit — never horizontal-sliced.

## Usage

```
/red-sweep <scope> <focus-area>
```

Examples:

- `/red-sweep src/auth security`
- `/red-sweep PR #142 input validation`
- `/red-sweep packages/api/ race conditions`

## Conventions

- Uses whatever test framework the repo already has (vitest, jest, pytest, go test, …).
- Files findings as GitHub issues if `gh` and a remote are available; otherwise writes a markdown report.
- Tests verify behavior through public interfaces. Mocks only at system boundaries.
