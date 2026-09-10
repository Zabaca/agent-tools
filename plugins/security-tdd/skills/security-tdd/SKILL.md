---
name: security-tdd
description: Three-test TDD pattern (green-contract → red-exploit → green-fix) for security findings, regression-prone refactors, and any change where you want both "the legitimate flow still works" and "the bug is closed" verified before shipping. Use when user wants to fix a vulnerability, audit finding, leak, or behavior bug TDD-style.
---

# Security TDD — Three-Test Pattern

A specialization of `/tdd` for security findings, audit punch-lists, and any change where the test must prove **two things**: the legitimate path still works, and the exploit / leak is closed.

Standard TDD writes one failing test, makes it green, repeats. That's right for *new* features. For *security fixes* and *regression-prone refactors* it's not enough — a fix that passes a single new test can still silently break the working contract you didn't bother to assert.

This pattern adds a deliberate "green-contract" test before the "red-exploit" test. Same vertical slicing as `/tdd`; one extra verification per cycle.

## When to use this

Reach for this skill when **any** of these are true:

- You're fixing a security finding (CVE-style, audit issue, pen-test report)
- The change is "tighten an existing path" rather than "add a new feature"
- The bug is a leak, an oracle, an auth gap, or a missing guard
- You're worried that fixing the bug will accidentally break a legitimate caller
- The risk profile reads "low chance of breakage but high cost if we do"

For brand-new features that have no existing contract to lock down, plain `/tdd` is correct. Don't bolt on a green-contract test if there's no contract yet to defend.

## The three tests, per issue

For **each** issue, write tests in this order. Run after each step.

### 1. Green-contract test — passes today, must keep passing

Asserts the **legitimate** path still works after the fix. This is the user the fix is meant to serve.

- Examples: "owner with valid cookie still gets 200 PDF"; "well-formed admin token authenticates"; "small body returns 200"; "successful callback still triggers email send"
- Run it. **It must already pass** (no fix has been written yet — you're locking down today's working behavior).
- If it fails, you don't understand the contract well enough to fix it. Stop and investigate before continuing.

### 2. Red-exploit test — fails today, captures the bug

Asserts the **secure** behavior the bug violates. The vulnerability, the leak, or the broken invariant.

- Examples: "not-mine and not-found return the same 404"; "malformed-payload token is rejected"; "oversized body returns 413"; "rendered email body does NOT contain the plaintext password"
- Run it. **It must fail** (the bug exists; you haven't fixed it yet).
- The diff between the failing assertion's actual and expected values *is* the bug, made concrete and reproducible. This is the artifact you'll point to in the PR description.

### 3. Apply the fix, confirm both green

Make the minimum change to flip the red test to green. Then run **both** tests:

- Green-contract: still passes (you didn't break the legitimate flow).
- Red-exploit: now passes (the bug is closed).

If green-contract starts failing after the fix, you've over-corrected. Roll back, narrow the fix.

## Vertical slicing — one issue at a time

Same anti-pattern as `/tdd`: do not write all green-contract tests for all issues, then all red-exploit tests, then all fixes. Per issue: green → red → fix. Then move on.

The reason is identical to `/tdd`'s rationale: tests written in bulk test imagined behavior. Tests written one at a time, against code you just touched, test actual behavior.

## What goes in each test file

One test file per issue. The file documents the **why** at the top:

```ts
// Issue #123 — <one-line statement of the bug>
//
// <2-3 sentences: where the bug lives, what triggers it, what the
// security/correctness impact is>
//
// Test pattern (per /security-tdd):
//   • green-contract: <what legitimate behavior is preserved>
//   • red-exploit:    <what unsafe behavior is now blocked>
```

Issue number in the file name keeps PR review legible:

- `pdf-cache-control.test.ts` (#123)
- `jwt-shape-validation.test.ts` (#102)
- `submit-application-size-cap.test.ts` (#138)

## Worked example (security finding)

**Finding**: PDF response missing `Cache-Control: no-store` — CDN edge can serve to a different session (#123).

**Green-contract** (passes today):
```ts
it('application-summary still returns 200 application/pdf', async () => {
  const res = await invokeRoute(summaryGet, { ...asAdmin(), params: { id: order.id } });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('application/pdf');
});
```

**Red-exploit** (fails today):
```ts
it('application-summary sets Cache-Control: no-store', async () => {
  const res = await invokeRoute(summaryGet, { ...asAdmin(), params: { id: order.id } });
  expect(res.headers.get('cache-control')).toBeTruthy();
  expect(res.headers.get('cache-control')!.toLowerCase()).toContain('no-store');
});
```

**Fix**: add `'Cache-Control': 'no-store, must-revalidate'` to the response headers. Re-run — both pass.

## When the green-contract is already covered

If an existing test already asserts the legitimate path (e.g. an existing PDF render smoke), reference it in the new file's preamble and skip duplicating. The point is that *something* in the suite is locking down today's behavior — not that every new file restates it.

But beware false confidence: an existing test that asserts the *response shape* doesn't necessarily lock down the *headers* you're about to change. Read the existing test before deciding it covers your contract.

## When you can't write a backend test (UI, email content, etc.)

Some bugs live in the browser or in third-party transit. You can still apply the pattern partially:

1. Write whatever **backend contract** you *can* lock down (e.g. "this endpoint returns 401 when no auth header is present" — proves the FE retry would have failed if the FE wasn't lying to itself).
2. Apply the FE/email fix.
3. Add a **REQUIRED browser smoke** checklist to the PR description with specific reproduction steps.
4. Mention in the commit body that the change needs preview-deploy verification beyond unit tests.

Never silently downgrade to "I just made the change, trust me." Be explicit about what you couldn't test.

## PR shape

- One PR per cluster of related fixes when they share a theme (header hygiene, auth shape gates, etc.).
- PR description quotes both the green-contract and red-exploit assertions for each issue, so reviewers see the safety net.
- Split TDD-only fixes from need-browser-smoke fixes into separate PRs — different review urgency, different verification expectations.

## Checklist per cycle

```
[ ] Green-contract test asserts a legitimate, currently-working path
[ ] Green-contract test runs and passes BEFORE any fix
[ ] Red-exploit test asserts the secure behavior, named after the issue #
[ ] Red-exploit test runs and FAILS BEFORE the fix (you've reproduced the bug)
[ ] Fix is the minimum change to flip red → green
[ ] After fix: BOTH tests pass; existing suite is still green
[ ] If FE/email/UI: PR includes a manual smoke checklist
```
