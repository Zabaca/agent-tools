---
name: branch-impact
description: Assess a branch or working tree against main and report outcome, impact, and risk, via an independent read-only assessor that baseline-tests every risk so pre-existing conditions are never reported as new defects. Use when the user asks what the impact, risk, blast radius, or outcome of this branch/PR/change is, whether it's safe to merge or ship, or "what does this change vs main".
---

# Branch Impact

Thin entry point. The method lives in the **`branch-impact` agent** — spawn it
rather than doing the assessment yourself.

## Why it runs in a subagent

The assessment's core discipline is that a risk only counts if it is **new or
worsened relative to main**. The person most likely to get that wrong is whoever
wrote the branch: authors read their branch's hazards as hazards it *introduced*,
which inverts the recommendation — you end up flagging things main already does
worse. If this conversation built the work, it carries that bias. A fresh agent
does not.

So: **do not fork.** A fork inherits this conversation and its framing, which is
the exact thing being controlled for. Spawn `subagent_type: "branch-impact"`.

## Your job before spawning

The agent starts with no context and can read git, but **cannot discover state
changed outside the diff**. That state is often the most decision-relevant thing
in the report. Before spawning, collect anything this session knows that git does
not:

- Infra started, stopped, or removed (containers, services, volumes)
- Config repointed outside version control (`.env`, credentials, hosts)
- Migrations or seeds already applied, and to which database
- Anything published, deployed, or sent externally
- Which of the above are machine-local vs. would travel with a merge

Pass these as plain facts, not conclusions. Do **not** pass your own read of what
is risky, what the branch was trying to achieve, or how you would rank anything —
that is the framing the agent exists to avoid inheriting. If you have no
out-of-band state to report, say so explicitly; silence reads as "nothing
happened," and the agent will report accordingly.

Also pass: the repo path and the base to compare against, if it isn't
`origin/main`.

## After it returns

The agent's report is **not shown to the user** — relay it. It is written in
finished form, so pass it through substantially intact rather than summarizing it
into a paragraph. Add anything you know that it flagged as unverifiable, and mark
it as your addition.

If its verdict contradicts something you told the user earlier in this
conversation, correct that plainly in the same message.

## When to skip the agent

For a one-file, few-line change where the baseline test is a single `git show`,
just do it inline using the method in the agent definition. Spawning costs more
than it returns at that size. Everything else goes to the agent.
