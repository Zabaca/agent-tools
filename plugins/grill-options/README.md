# grill-options

`/grill-with-docs` grills you. This grills Claude instead, and hands you the
finished choices.

## What it does

A grilling subagent interviews the main thread about your plan, round by round,
walking the design tree until the frontier is empty. It gets your subject and
your constraints — not Claude's analysis of them — and establishes its own facts
from the repo before it asks anything. Claude answers from the codebase and from
what you actually said.

Where a question is a genuine value trade-off your brief does not settle, Claude
does not guess: it pins its recommendation, records a **fork point**, and the
session carries on as one coherent tree. When that variant is finished and
written up, a fresh grilling agent starts the next one from the opposite answer.
**One variant at a time, never in parallel** — a session juggling branches asks
shallower questions of each.

You end up with 2–4 complete, internally consistent options, each with its
outcome, blast radius, pros, cons, and the condition under which it is the wrong
pick — plus a comparison table and one recommendation. You make one decision.

## Usage

```
/grill-options <your plan, feature, or design question>
```

The run is hands-off. You are not interrupted between kickoff and the options.

## What it writes

- `<scratch>/options-<slug>.md` — written during the run, one section per branch
  as that branch finishes. Scratch, not the repo: it is working material for an
  undecided question, so it never gets committed.
- `docs/adr/…` — written **after** you pick, with the rejected options as the
  alternatives-considered section. The only file it adds to the repo.

Nothing else. It does not touch `CONTEXT.md`.

## Design notes

- **Fork gates.** A question becomes a fork point only if both answers survive
  your brief, you would feel the difference, and the difference survives to the
  end of the tree. Everything else Claude answers itself and, if it was close,
  records as a close call you can reopen.
- **Sequential variants.** One grilling agent alive at a time. Each variant
  carries forward the common ground the previous ones settled, so every variant
  after the first is cheaper than the last.
- **Budget.** At most 3 fork points explored and 4 variants. Extra fork points
  are answered by recommendation rather than spawning more sessions.
- **The griller verifies the brief.** It reads the repo and disputes what it
  cannot confirm before round 1. A round 1 with no tool calls means it is
  grilling Claude's framing rather than your subject.
- **Questions only you could answer** — facts about your intentions, not about
  the world — are not handed back to you. They become the option's **Wrong if**
  condition, so you can see what your choice rests on.
- **Eliminated branches.** A branch that grilling proves violates a hard
  constraint is reported as eliminated, with the question that killed it.

## Related

- `mattpocock-skills:grilling` — the round/frontier interview primitive this
  inverts.
- `mattpocock-skills:grill-with-docs` — the version where you answer the
  questions.
