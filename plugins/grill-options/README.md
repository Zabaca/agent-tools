# grill-options

`/grill-with-docs` grills you. This grills Claude instead, and hands you the
finished choices.

## What it does

A grilling subagent interviews the main thread about your plan, round by round,
walking the design tree until the frontier is empty. Claude answers from the
codebase and from what you actually said. Where a question is a genuine value
trade-off that your brief does not settle, Claude does not guess — the tree
**forks**, and both branches get grilled to completion.

You end up with 2–4 complete, internally consistent options, each with its
outcome, blast radius, pros, cons, and the condition under which it is the wrong
pick — plus a comparison table and one recommendation. You make one decision.

## Usage

```
/grill-options <your plan, feature, or design question>
```

The run is hands-off. You are not interrupted between kickoff and the options.

## What it writes

- `docs/options/<slug>.md` — written during the run, one section per branch as
  that branch finishes.
- `docs/adr/…` — written **after** you pick, with the rejected options as the
  alternatives-considered section.

Nothing else. It does not touch `CONTEXT.md`.

## Design notes

- **Fork gates.** A question forks only if both answers survive your brief, you
  would feel the difference, and the difference survives to the end of the tree.
  Everything else Claude answers itself and, if it was close, records as a
  close call you can reopen.
- **Budget.** At most 3 fork axes and 4 final options. Extra axes are answered
  by recommendation rather than expanding the tree.
- **Eliminated branches.** A branch that grilling proves violates a hard
  constraint is reported as eliminated, with the question that killed it.

## Related

- `mattpocock-skills:grilling` — the round/frontier interview primitive this
  inverts.
- `mattpocock-skills:grill-with-docs` — the version where you answer the
  questions.
