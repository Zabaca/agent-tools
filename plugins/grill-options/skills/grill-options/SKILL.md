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

One variant at a time. A variant is grilled to an empty frontier and written up
as a complete option before the next variant starts. Never run variants in
parallel, and never let one grilling session hold two branches at once — a
grilling agent juggling branches asks shallower questions of each, and you
answer them worse.

### 1. Kickoff — hand over the subject, not your analysis

Give the grilling agent the subject in the user's own words, verbatim, plus the
constraints they stated, anything they explicitly ruled out, and the path to the
repo. That is all.

Do NOT hand it your own reading of the problem: no candidate groupings, no
hypotheses, no table of facts you already gathered, no shortlist of what you
think the options are. That material pre-draws the map the agent exists to draw,
and you will get your own assumptions back with question marks on them.

The agent must establish its own facts before round 1 — read the repo, run what
it can run, and open by contesting anything it cannot verify. A round 1 that
arrives with zero tool calls is a warning sign: the agent is grilling your
framing rather than the subject. Send it back to look before it asks.

### 2. Rounds

The grilling agent asks a **round**: every question on the frontier — decisions
whose prerequisites are already settled — and nothing that depends on an
unsettled answer. Each question is tagged `FACT` or `JUDGEMENT` by the agent;
you re-classify freely, the tag is a hint not a verdict.

You answer the whole round in one reply. For each question, pick one:

- **Answer from fact.** Read the code. Cite `file:line`. Where an answer can be
  settled by running something rather than reasoning about it, run it. Facts are
  never fork points and never questions for the user.
- **Answer from the brief.** The user already said this, explicitly or by
  clear implication. Quote their words in the answer.
- **Answer from judgement.** No real trade-off — one answer dominates given
  everything settled so far. Say why it dominates.
- **Answer and record a fork point.** See the gates below.

Never answer "ask the user". The user is not in the room. A question only the
user could truly settle — a fact about their intentions, not about the world —
gets answered with your best reading and becomes that option's **Wrong if**
condition, so the user sees exactly what their choice rests on.

A question about the world that you cannot settle — a GUI you cannot drive, a
service you cannot reach — is neither. Do not guess it and do not bury it in a
recommendation: answer conservatively, and record it as that option's **open
verification**, naming the consequence both ways. One glance from the user
settles it later; a guess pretends it is already settled.

Contradict the agent when it is wrong. A grilling agent that is never corrected
is being agreed with, not used.

### 3. The fork gates

A question is a **fork point** when all three hold:

1. **Both answers survive the brief.** Nothing the user said rules either out.
2. **The user would feel the difference.** Different cost, timeline, UX,
   operational burden, or reversibility — not just different internals.
3. **The difference survives to the end.** A later decision does not erase it.

Fail any gate and you simply answer it. A question that fails gate 2 but was
genuinely close gets answered *and* recorded as a **close call** — it appears in
the final report under the option it affects, so the user can reopen it.

A fork point does NOT branch the current session. Pin your recommended answer,
write the fork point down with both candidate answers, and let the grilling
agent carry on with the pin in place. The variant in flight stays one coherent
tree. The alternative answers are what later variants are made of.

### 4. The next variant

When a variant's frontier is empty and its option is written up, pick the
unexplored fork point with the largest downstream blast radius and start the
next variant on it.

Spawn a **fresh** grilling agent for each variant — the previous one's tree is
committed to its pins and cannot honestly re-open them. Hand the new agent:

- the same kickoff brief, unchanged;
- everything settled in earlier variants that does NOT hang off this fork point,
  marked as settled and not to be re-litigated;
- the fork point, pinned to the answer this variant is exploring.

Each variant after the first is cheaper than the last, because the common ground
keeps growing.

**A later variant will break an earlier variant's facts.** Expect it — a fresh
agent checks things the last one took on trust. When it happens, go back and
correct the option already written: fix the claim, and re-grade any Pro or Con
that rested on it, even if that turns a benefit into a cost. An options document
whose first option is argued on facts its third option disproved is worse than
useless, because it reads as finished. Corrections propagate backward; that is
the reason variants run in sequence rather than at once. If a variant's grilling reveals it is not actually distinct once
finished — same outcome, same impact — merge it into the option it duplicates
and move to the next fork point.

### 5. Budget

Hard caps, because fork points multiply:

- **4 variants** maximum, so at most 4 sequential grilling sessions.
- **3 fork points** explored; the rest are answered and listed as close calls.
- If a fifth fork point passes the gates, keep the ones with the largest
  downstream blast radius and answer the others with your recommendation.

### 6. Termination

A variant is done when its frontier is empty and the grilling agent confirms it
explicitly. Every variant must reach that state — a half-grilled option is not
an option, it is a guess with a table around it. Kill a variant outright if
grilling reveals it violates a hard constraint from the brief, and report it as
**eliminated**, with the question that killed it. An eliminated variant does not
consume a slot; move to the next fork point.

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
> Before round 1, go and look: read the repo, run what you can run, and verify
> the brief rather than trusting it. Open by contesting any claim in it you
> could not confirm. Asking questions off an unverified brief is the one way
> this session fails silently.
>
> The answering agent may reply `FORK POINT: <pinned answer> | <alternative>`.
> That is not an instruction to branch. Carry on with the pinned answer in
> place, on one tree. The alternative is explored in a separate session later,
> and is not your concern.
>
> Push on: what breaks under load, what happens on failure, what the user
> cannot undo, what is being assumed about scale, who else depends on this,
> and what the plan silently does not do. Stop when the frontier is empty on
> every branch, and say so explicitly per branch.

Give each grilling agent **its own scratch directory** and tell it to write
nowhere else. A griller that runs experiments will otherwise collide with your
own scratch fixtures — that happens, and you lose a fixture mid-round without
noticing why.

Spawn it with the Agent tool, then continue the *same* agent each round with
SendMessage addressed to its name — a fresh `Agent` call loses the tree. One
agent per variant, for the whole of that variant: the tree is its context.

Never run two grilling agents at once. The next variant's agent is spawned only
after the current variant's option is written.

Facts are yours to find. If the grilling agent asks something the repo can
answer and you would need to search widely, dispatch a read-only search
subagent rather than guessing or stalling the round.

## It's working if

- The user is asked nothing between kickoff and the final options.
- Round 1 arrives with the agent having read the repo itself, and disputes
  something in your brief.
- One grilling agent is alive at a time, and each variant is finished before the
  next begins.
- Every option is grilled to an empty frontier, not to a token budget.
- Two options differ on a decision you can name in one sentence.
- The facts in the answers cite real `file:line`, not recollection.
- Some questions get answered, not recorded as fork points — a run that forks
  everything has abdicated, not analysed.
- You corrected the grilling agent at least once on a fact it got wrong, and it
  corrected you at least once on a fact you got wrong.
- When you asked whether the frontier was empty, the agent was willing to say no.
- A rejected option reads as something a competent person would have chosen.
- The final message is a choice, not a plan of action.
