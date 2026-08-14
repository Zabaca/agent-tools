# ship

Work a dependency-ordered ticket backlog to done, with the orchestrating session
staying out of the implementation.

The session that runs `/ship` never writes implementation code. It resolves the
frontier of a ticket DAG, dispatches one sub-agent per ready ticket, reviews
their work independently, drives bounded fix rounds, merges, and moves on.

## Why an independent reviewer

`/implement` ends by telling the implementer to review its own work. `ship`
overrides that one line: the orchestrator runs `/code-review`, not the
sub-agent. A self-review inherits every assumption that produced the bug.

## What it assumes

- A tracker described in `docs/agents/issue-tracker.md` — run
  `/setup-matt-pocock-skills` if it is missing.
- Tickets carrying dependency edges. GitHub's native issue dependencies are
  read directly; other trackers fall back to a parsed "Blocked by" section.
- Matt Pocock's engineering skills installed, for `/code-review` and `/tdd`.

## Two things that bite

`/implement` is `disable-model-invocation: true`. A sub-agent that calls it gets
an error saying it is reserved for explicit user invocation — and instructing
the caller not to replicate its workflow by other means. So `ship` does not
stand in for it: the implementer brief carries `ship`'s own working agreement,
and tells the sub-agent not to read that skill file either. Sub-agents invoke
`/tdd` directly, which is model-invocable.

`/code-review` finds the originating spec through issue references in commit
messages. Commits that do not say `Closes #<n>` make the Spec axis silently
report "no spec available" — so the brief requires the reference, and the
orchestrator checks for it before trusting a clean review.

## Bounds

Two fix rounds per ticket, then it escalates. Anything outward-facing —
publishing, deploying, force-pushing, secrets — stops for explicit approval
every time.
