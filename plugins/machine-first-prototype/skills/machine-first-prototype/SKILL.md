---
name: machine-first-prototype
description: "Turn app screenshots into a working prototype: model the state machines first, verify them headlessly, then render three ways — bare, designed, and a state explorer. Use when given screenshots and asked to prototype or model an app's states."
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
- Show which events the current configuration has **no handler for at all**,
  separately from the ones it accepts. That distinction is the whole point of
  the rendering.
- Print the live state value for every actor, including each parallel region.
- Native controls, hairline borders, no colour system.

**Three rules that decide whether anyone can actually read it.** Six bare
renderings were built before these were written down, and five were unreadable
in the same three ways.

- **Keep the designed layout.** Same columns, same widths, same panes, same
  starting state — stripped, not rearranged. It is tempting to stack everything
  into one scroll because layout utilities are permitted and nothing forbids it;
  one build flattened a three-column workspace under a heading that still read
  *"The three columns"*. The renderings exist to claim **same behaviour,
  different presentation**, and that claim is checkable by eye only if the layout
  is the constant.
- **Give nesting a depth ramp.** "No colour, no shadow, no radius, no weight" is
  very nearly a list of the properties that encode hierarchy, leaving containment
  and indentation. Two levels deep that is fine; four levels deep every level
  draws the same 1px box and the page becomes one texture. So define three
  neutral greyscale surfaces keyed to *nesting depth* — not to meaning — and
  apply them by depth. Watch for a thick side rule (`border-l-4`) appearing:
  independent authors reach for it when it is the only distinguishing device
  left, which means the ramp is what they wanted.
- **Do not teach in it.** The model belongs in the states explorer, beside the
  state it describes, and in the README. A bare page carrying paragraphs about
  parallel regions and a checkbox per exported state path is two documents
  interleaved — a specification and a product, both drawn as 1px boxes, with
  nothing to tell them apart. Keep **instrumentation** instead, in a thin band
  above or below the page: live region paths, accepted events, unhandled events,
  what the spawned children are doing.

The mechanical tell of the third one is an import of the exported
`*_STATE_PATHS` list into the bare page. Live paths come off the snapshot and
need no import.

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

**Give it a map.** This page ends up twenty to forty cards long, and every build
so far produced one unbroken scroll: you cannot see what is on the page without
paging through it, you cannot return to a state you passed, and you cannot tell
anyone else where one is.

- **An index down the left**, in a `<nav aria-label="States">`, sticky, with its
  own scroll. It lists every **scenario** under its machine, not only the
  machines — the machine headings were always findable and the states were not.
- **Every card carries an `id`**, so an index entry is a jump and a state is a
  link somebody can send. Assert that every index link resolves to exactly one
  card: renaming a scenario leaves a link that still renders, still looks right,
  and goes nowhere, and nothing else on the page can tell.
- **One filter, shared.** A search over scenario names and state paths, spanning
  every machine, with the index counts and the cards computed from the same
  predicate so they cannot disagree. A control sitting beside one grid that
  silently binds only that grid's scenarios is worse than none — that is what
  one build shipped, purely because there was no list of machines to hang a
  shared control off.
- **Put the how-this-works prose behind a `<details>`.** The first viewport
  should open on the index and the cards, not two paragraphs about freezing.
- **Drive each card once, keyed on the reset counter — not a boolean cleared by
  a second effect.** React double-invokes effects in development and runs the
  clearing effect's second pass first, so every drive is sent twice: harmless
  for an idempotent event, and a toggle flips back. One build had a card
  headed "Collapsed" sitting in `expanded`, on the page whose whole purpose is
  showing which state something is in.
- **Assert that no card claims a state its actor is not in.** The coverage
  banner compares *declared* paths against the machine's list, so a card that
  declares one state and reaches another satisfies it. Publish the claimed
  paths beside the live ones and compare them in a test — it is the same
  comparison the card already makes to decide whether to offer Reset.
- **Choose columns or a grid on the evidence.** Card heights vary enormously — a
  four-line `loading` card beside a card rendering a whole application — and a
  grid row is as tall as its tallest member, so one build left half a screen of
  dead space. `columns-[Npx]` with `break-inside-avoid` packs them. The cost is
  reading order, down each column rather than across, so it is only worth paying
  where the heights really do differ; look at the page before deciding.

### 7. Verify in a browser

Screenshot every page headlessly and **look at them**. Then drive the real
interactions over the DevTools Protocol — clicking, typing, and reading back
state. Screenshots alone miss overlap, z-index, and anything behind a click.

`SCAFFOLD.md` has the exact commands and a reusable CDP driver.

Report what the driver printed, not a claim that it works.

**Keep a browser-seam test, not just screenshots.** A page that renders one frame
stale passes every headless check: it mounts, nothing throws, no resource fails.
It took a purpose-written browser test to catch a page whose machines had both
carousels suspended while the DOM said they were advancing. Anything that is a
claim about **React** rather than about a machine — a view that does not repaint,
a control that never reaches an actor, text disagreeing with its own snapshot —
is invisible at the actor seam and belongs here.

The bare page is the surface to drive. It turns implicit inputs (scroll, hover,
elapsed time) into explicit controls and publishes state as attributes, so a test
can assert *"the machine is in `advance.paused`"* by reading a `data-` attribute
rather than inferring it from pixels.

### 8. Ship the check with the rule

Any rule stated here that a script could verify, verify. A rule that lives only
in prose is a rule the next build will drift from — one of these documents
claimed for six builds that a constraint was "mechanically checkable, one file to
grep", and nothing was grepping it. When the grep was finally written it found
five violations, all introduced by authors who had read the rule.

A source scan is a legitimate test when the property is about what the source
says, and no amount of driving a page can observe "this class was never used".
Two worth having: the banned-utility grep over the bare skin, and a check that
the bare layout still matches the designed one.

Where the property is about the **rendered document** rather than the source,
the same principle sends it to the browser seam instead. The states index is the
example: that every link in it resolves to exactly one card is unobservable from
the source, invisible to every other gate, and the exact thing that rots when
somebody renames a scenario six weeks later.

Then **mutation-check it** — break the behaviour on purpose and confirm the test
fails. Several tests written across these builds passed vacuously: one asserted a
refusal that was really a 415 from the body parser, another covered a guard that
was unreachable, and it passed *because* the guard was inert. Any error satisfies
"it failed", including the wrong one.

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
- A bare page that stacks what the designed page lays out in columns, or that
  teaches the model instead of instrumenting the product.
- Freezing the explorer with `Number.MAX_SAFE_INTEGER`. It overflows
  `setTimeout`'s 32-bit delay and is clamped to 1ms, so the "frozen" state
  advances immediately. Use `2_147_483_647`.
- A guarded push-down whose guard reads the child it is about to write to. It
  terminates only when the event came from outside the child, so it works until
  the day an interaction starts there, and then it hangs silently.
- Stating a rule nothing checks. If a script could verify it, write the script;
  otherwise expect the next build to break the rule while believing it followed
  it.
- Claiming a page works because it compiled. Run it, screenshot it, click it.
