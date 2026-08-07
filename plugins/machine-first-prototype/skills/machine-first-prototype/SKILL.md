---
name: machine-first-prototype
description: Turn app screenshots into a working prototype: model the state machines first, verify them headlessly, then render three ways — bare, designed, and a state explorer. Use when given screenshots and asked to prototype or model an app's states.
user-invocable: true
---

# Machine-First Prototyping

A construction skill. It does ONE thing: take screenshots of a piece of software
and produce a running prototype whose behaviour lives in state machines, rendered
three ways — bare, designed, and as a state explorer.

It is not a visual cloning exercise. The screenshots are evidence about *what
states exist*; the deliverable is a behaviour model you can click through.

## When this applies

- The user pastes a screenshot (or several) of an app and asks for a prototype,
  a rebuild, a model, or "a machine for this".
- The user asks to explore or enumerate the UI states of something.

Do NOT use this for static marketing pages, or when the user wants a pixel copy
with no behaviour. Those need a design skill, not this one.

## The output

```
<name>-proto/
  src/machines/*.ts     one file per machine
  src/domain.ts         types + pure helpers, no framework
  src/data/seed.ts      sample data rich enough to reach every state
  src/hooks.ts          React binding, derived views, transition log
  src/components/       design-system components
  src/pages/            BarePage, DesignedPage, StatesPage
  src/styles/           tokens.css, app.css, bare.css
  scripts/drive.ts      headless assertions over the machines
  README.md
```

Three routes: `#/bare`, `#/designed`, `#/states`.

## The pipeline

**The order is the product.** Every phase gates the next. Do not start UI before
the machines pass.

### 1. Read the screenshots and pick the machines

Name what you see, then decide what is genuinely stateful. Most of a screenshot
is not.

Ask of each candidate: **does this change which events are legal?** If yes it is
a state. If it only changes what is displayed, it is context.

Good machine candidates, in rough order of how often they pay off:

| Signal in the screenshot | Likely machine |
| --- | --- |
| A status word that gates buttons (Running, Blocked, Sending) | lifecycle machine |
| Anything with an Undo affordance | a state with a delayed transition, not a dialog |
| A save/sync indicator | sync lifecycle with a separate offline branch |
| A composer, draft box, or comment field | draft → posting → posted, with a cancel that leaves nothing behind |
| A per-item spinner or progress bar | one actor per item |
| A mode selector that changes what typing does | a region that gates edit events |
| Multiple independent flags on one row (read, starred, pinned) | **parallel regions**, not one enum |

Then decide the decomposition. Almost always: **one parent owning the
collection, one child actor per item.** Children never reach across to each
other; cross-item facts are reconciled by the parent and pushed down as events.

Announce the pick in one line before writing code: *"Three machines: X (parent),
Y per item, Z per file."*

**Scope deliberately and say so.** A real app has fifty states; pick the three
or four richest and name what you left out.

### 2. Write the machines

XState v5. Read `PATTERNS.md` in this skill directory before writing — it has
the concrete recipes for data-dependent entry, undo windows, parallel regions,
child pruning, cross-actor facts, and freezing for the explorer.

Two rules that matter more than the rest:

- **Export an addressable state-path list per machine** (`const XXX_PATHS = [...] as const`).
  The explorer's coverage check reads it. Adding a state without a screen must
  turn the banner amber.
- **Name every delay** (`delays: { undoWindow: 5000 }`). Unnamed numeric delays
  cannot be frozen, and the explorer needs to freeze them.

### 3. Verify headlessly — before any UI

Write `scripts/drive.ts` and run it. **Do not write a component until it
passes.**

Assert the things that are easy to get wrong and invisible in a screenshot:

- Events that must be refused (`!snapshot.can({type:'X'})`) — this is the real
  test that guards work.
- Independence of parallel regions ("archiving must not mark it read").
- That an undo window actually expires.
- That a seeded failure recovers on retry.
- That a final state accepts nothing.

This phase is not ceremony. Across three builds it caught:

- an `UNDO` handler placed on the parent instead of the timed child state, which
  made the undo window decorative;
- a compose actor that never finished because a parallel machine only completes
  when *every* region is final — which in turn revealed that nothing closed a
  sent window;
- a guard that could never fail because the fallback transition was unguarded.

None of those are visible in a rendered screenshot. All were cheap to fix at
this stage and expensive later.

### 4. Bare page

Same machines, no design system. Its job is to prove behaviour is complete
before any visual decision is made, and it is where behaviour gaps surface
without design covering for them.

- Render one button per accepted event, filtered from a single candidate list
  through `snapshot.can()`. Never hard-code which buttons a status gets.
- Print the raw state value for every actor, including each parallel region.
- Native controls, hairline borders, no colour system.

### 5. Designed page

Now add the design system. Tokens file first, then components.

- Match the screenshot's structure and density, not its pixels.
- Every control still comes from `can()`. If a component needs
  `if (status === 'x')` on stored data, the model is wrong — stored status
  should be a *projection* of machine state, written on entry and used only for
  grouping.
- Cover the states a screenshot never shows: loading, empty (per container, with
  copy that says what would put something there), filtered-empty (different copy
  — "no matches" is a different problem from "nothing here"), error, and every
  in-flight state.

### 6. States page

One card per machine state, each rendering the **real component** driven by a
**real actor** parked in that state.

- Use a frozen build (`machine.provide({actors, delays})`) so nothing advances
  while the user reads. Same states, same guards, same transitions.
- Seed context per scenario. `workerFailed` without an error message is not an
  honest rendering of that state.
- Let the buttons work, and show a Reset when a card drifts.
- Show a coverage banner comparing scenarios against the exported path list.
- Give each card a one-line blurb and the question it answers for the user.

### 7. Verify in a browser

Screenshot every page headlessly and **look at them**. Then drive the real
interactions over the DevTools Protocol — clicking, typing, and reading back
state. Screenshots alone miss overlap, z-index, and anything behind a click.

`SCAFFOLD.md` has the exact commands and a reusable CDP driver.

Report what the driver printed, not a claim that it works.

## Reporting

State the machine decomposition, the one or two states that were the reason to
build it, the assertion count, and any bug the process caught. Name what you
scoped out. If a screenshot revealed a rendering bug, say so and say what fixed
it.

## Anti-patterns

- Building UI first and retrofitting a machine. The machine ends up mirroring
  the components instead of the domain.
- One flat status enum for facts that are independent. This is the single most
  common modelling error in this problem space.
- A `disabled` attribute where the machine should simply not accept the event.
  If a control is inert, prefer "the state has no handler" over "the UI greyed
  it out" — then the affordance cannot drift from the rule.
- Swallowing a refused action. If a guard rejects an event, give it a state that
  explains itself rather than ignoring the click.
- A second "demo" copy of a machine for the explorer. Use `.provide()`; a copy
  drifts.
- Claiming a page works because it compiled. Run it, screenshot it, click it.
