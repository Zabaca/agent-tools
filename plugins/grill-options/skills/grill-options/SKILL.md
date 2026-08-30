---
name: grill-options
description: A subagent grills Claude, not you, about a plan. Claude answers from the codebase and forks the design tree at every real value tradeoff. You get 2-4 fully-grilled options with impact, outcome, and pros/cons, and pick one at the end.
user-invocable: true
---

# Grill Options

An inversion of `/grill-with-docs`. There, the agent grills the user. Here a
**grilling agent** grills *you* (the main thread), you answer from the codebase
and the user's stated goal, and every question you legitimately cannot answer
for the user becomes a **fork** in the design tree instead of a question in
their inbox.

The deliverable is not one sharpened plan. It is **2–4 fully-grilled options**,
each complete and internally consistent, with the impact, outcome, and
trade-offs written out, and one recommendation. The user makes exactly one
decision: which option.

## When this applies

The user types `/grill-options` (or asks for "grilled options", "grill it and
give me choices", "fully grilled options to choose from"). Never invoke this on
your own — it spends a lot of tokens and it presumes the user wants to be absent
for the interview.

Use `/grill-with-docs` instead when the user wants to be *in* the interview.
Use this when they want the interview to happen without them and to be handed
the finished choices.

## Roles

| Role | Who | Does | Never does |
| --- | --- | --- | --- |
| Grilling agent | Subagent | Owns the design tree and the frontier; asks rounds | Answers its own questions; reads the user's mind |
| Answerer | You, the main thread | Answers from the codebase, the user's words, and judgement; declares forks | Invents a user preference and passes it off as settled |
| Decider | The user | Picks an option at the end | Gets interrupted mid-run |

The run is **hands-off**. Do not go back to the user between the kickoff and the
final options, except to abort if the request is fundamentally underspecified —
"build the thing" with no thing.

## The loop

### 1. Kickoff

Capture the subject in the user's own words, verbatim, into a brief. Add: the
repo, the constraints they stated, anything they explicitly ruled out. This
brief is the *only* source of user intent you get. Anything not in it, and not
derivable from the codebase, is a candidate fork — not something to assume.

Spawn one grilling agent with the brief and the grilling contract below.

### 2. Rounds

The grilling agent asks a **round**: every question on the frontier — decisions
whose prerequisites are already settled — and nothing that depends on an
unsettled answer. Each question is tagged `FACT` or `JUDGEMENT` by the agent;
you re-classify freely, the tag is a hint not a verdict.

You answer the whole round in one reply. For each question, pick one:

- **Answer from fact.** Read the code. Cite `file:line`. Facts are never
  forks and never questions for the user.
- **Answer from the brief.** The user already said this, explicitly or by
  clear implication. Quote their words in the answer.
- **Answer from judgement.** No real trade-off — one answer dominates given
  everything settled so far. Say why it dominates.
- **Fork.** See the gates below.

Never answer "ask the user". The user is not in the room.

### 3. The fork gates

Fork only when **all three** hold:

1. **Both answers survive the brief.** Nothing the user said rules either out.
2. **The user would feel the difference.** Different cost, timeline, UX,
   operational burden, or reversibility — not just different internals.
3. **The difference survives to the end.** A later decision does not erase it.

Fail any gate and you answer it yourself. A question that fails gate 2 but was
genuinely close gets answered *and* recorded as a **close call** — it appears in
the final report under the option it affects, so the user can reopen it.

When you fork, tell the grilling agent to continue **both** branches: same tree,
that answer pinned differently. Branches that reconverge — identical remaining
frontier, identical pinned answers downstream — merge back; do not re-grill
shared subtrees.

### 4. Budget

Hard caps, because the tree is exponential:

- **3 fork axes** maximum.
- **4 final options** maximum.
- If a fifth axis passes the gates, keep the axes with the largest downstream
  blast radius, answer the rest with your recommendation, and list them as close
  calls.

### 5. Termination

A branch is done when its frontier is empty and the grilling agent has nothing
left. Every branch must reach that state — a half-grilled option is not an
option, it is a guess with a table around it. Kill a branch outright if grilling
reveals it violates a hard constraint from the brief, and report it as
**eliminated**, with the question that killed it.

## The options document

Write `docs/options/<slug>.md` **during** the run — one section per branch, filled
in as that branch completes, not batched at the end. Then report the same content
in the terminal.

Per option:

- **Name and thesis.** One line. Name it for what makes it different, not
  "Option A".
- **The diff.** The forked answers that define it, and only those. If two
  options share an answer it does not belong here.
- **Outcome.** What the user concretely ends up with. Screens, commands,
  behaviour — not architecture prose.
- **Impact.** Blast radius (which files, systems, contracts), rough effort,
  what it forecloses, and how reversible it is.
- **Pros / Cons.** Consequences, not adjectives. Each one traceable to a
  grilled answer.
- **Wrong if.** The condition under which this option is the wrong pick. If you
  cannot write one, the option is not distinct enough — merge it.
- **Close calls.** Questions this option's branch nearly forked on.

Then a comparison table across options on the axes that actually differ, and a
**recommendation**: one option, ranked reasoning, and what you would need to
learn to change your mind.

Present it. Stop. Do not start building.

## After the pick

The user chooses. Then:

1. Write the ADR under `docs/adr/` for the chosen option. Alternatives
   considered = the rejected options, with the reason each lost. This is the
   whole payoff of grilling them fully — the rejected branches are real
   analysis, not straw men.
2. Hand off: `to-spec` if the change is large, `implement` if it is small.

Do not touch `CONTEXT.md`, and do not write anything else to the repo. Options
doc and ADR only.

## The grilling agent's contract

Give the subagent this, verbatim, plus the brief:

> You are grilling another agent about a plan. Map the subject as a **design
> tree**: every decision branches into the decisions that hang off it. Work in
> **rounds**. The **frontier** is every decision whose prerequisites are already
> settled — the questions answerable now without guessing at answers you have
> not heard yet. Ask the whole frontier in one round, then stop and wait.
>
> Format every question as:
>
> ```
> ❓ **Q1** [FACT|JUDGEMENT] — **<title>**: <body, including options if it is a choice>
>
> ➡️ <your recommended answer>
> ```
>
> Tag `FACT` if the codebase or environment can settle it, `JUDGEMENT` if it is
> a design call. Never answer your own questions. Never soften a question
> because the answer seems obvious — an obvious answer is cheap to give.
>
> The answering agent may reply `FORK: <answer A> | <answer B>` to a question.
> When it does, continue the tree twice from that point, once per pinned answer,
> and label every later round with which branch it belongs to. Branches with an
> identical remaining frontier merge back into one.
>
> Push on: what breaks under load, what happens on failure, what the user
> cannot undo, what is being assumed about scale, who else depends on this,
> and what the plan silently does not do. Stop when the frontier is empty on
> every branch, and say so explicitly per branch.

Spawn it with the Agent tool, then continue the *same* agent each round with
SendMessage addressed to its name — a fresh `Agent` call loses the tree. Keep
one agent for the whole run — the tree is its context.
Spawn a second only if a fork produces two subtrees big enough to be worth
grilling in parallel; give the second one the settled answers so far and its
pinned branch.

Facts are yours to find. If the grilling agent asks something the repo can
answer and you would need to search widely, dispatch a read-only search
subagent rather than guessing or stalling the round.

## It's working if

- The user is asked nothing between kickoff and the final options.
- Every option is grilled to an empty frontier, not to a token budget.
- Two options differ on a decision you can name in one sentence.
- The facts in the answers cite real `file:line`, not recollection.
- Some questions get answered, not forked — a run that forks everything has
  abdicated, not analysed.
- A rejected option reads as something a competent person would have chosen.
- The final message is a choice, not a plan of action.
