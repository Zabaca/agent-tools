---
name: red-sweep
description: 'TDD-based issue discovery. Use when user wants to find bugs, security holes, or code quality issues by writing failing tests that prove problems exist. Triggers: "red sweep", "find issues", "audit this", "probe for bugs", "security audit", "find vulnerabilities".'
user-invocable: true
argument-hint: "<scope> <focus-area>"
---

# Red Sweep

Two-phase TDD-based issue discovery. The user defines the scope and focus; you write failing tests to prove problems exist, then fix them one at a time.

The red tests ARE the exploration tool. Don't speculate about issues — prove them with executable tests.

**Both phases are sequential and disciplined.** Phases are separate (all discovery, then all fixes), but *within* each phase you work strictly one item at a time. No batching.

## Phase 1 — Red Sweep (discovery)

1. **Get scope and focus from the user.** Scope = codebase, file, PR, or commit. Focus = what to look for (security, perf, correctness, race conditions, input validation, etc.).
2. **Detect the existing test framework.** Look at the repo — vitest, jest, pytest, go test, rspec, whatever's there. Use it. Don't introduce a new framework.
3. **Detect the issue-tracking standard.** GitHub issues if `gh` is available and the repo has a remote, otherwise default to a markdown report file (e.g. `RED-SWEEP.md`).
4. **Scan sequentially within the focus area, ONE issue at a time.** Loop:
   - Find the next plausible issue
   - Write ONE failing test that proves it exists
   - File the finding (issue or markdown entry) with reproduction steps and a link to the test
   - Then — and only then — go look for the next issue
5. **Do NOT fix anything during discovery.** Do NOT batch tests (no "let me write five tests at once"). One issue → one test → one filed finding → next issue.
6. Output at the end of Phase 1: a list of filed findings, each with its red test.

## Phase 2 — Vertical Fix

For each finding, one at a time:

1. Pick one finding.
2. Write the **minimal** fix that makes its red test pass.
3. Run the test. Confirm green.
4. Commit. **One finding, one fix, one commit.**
5. Move to the next finding.

**Never** horizontal-slice fixes (don't fix several things, then commit). **Never** refactor while red.

## Test quality rules

- Tests verify behavior through **public interfaces**, not implementation details.
- Tests should survive internal refactors.
- Mock **only at system boundaries** — external APIs, time, randomness, filesystem when truly needed.
- Minimal code per test. No speculative features. No "while I'm here" assertions.

## Per-cycle checklist

Discovery cycle:
- [ ] Test describes behavior, not implementation
- [ ] Test uses the public interface only
- [ ] Test would survive an internal refactor
- [ ] Finding is filed with reproduction steps

Fix cycle:
- [ ] Code change is the minimum needed for this test to pass
- [ ] Exactly one finding addressed in this commit
- [ ] No refactors smuggled in while red

## Anti-patterns

- Guessing at bugs without writing a test that proves them.
- Batching discovery: writing several red tests in one pass before filing any. Work one issue at a time.
- Bundling multiple fixes "since they're all small."
- Refactoring during the fix cycle — do that on a separate green pass.
- Mocking internal modules to make a test pass — that proves nothing.
