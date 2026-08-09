# XState v5 patterns for machine-first prototypes

Recipes that earned their place across several builds. All code is XState v5
(`setup().createMachine()`), which differs from v4 examples you will find
online: `Machine`→`createMachine`, `interpret`→`createActor`, `services`→`actors`,
`cond`→`guard`, `state`→`snapshot`, and `send('FOO')` string shorthand is gone.

---

## 1. Data-dependent entry (`routing`)

`initial` must be static, but a seeded item needs to start wherever its data
says. Add a `routing` state whose `always` transitions fan out on context. This
doubles as the mechanism the states-explorer page uses to park an actor
anywhere.

```ts
export const TICKET_STATE_PATHS = [
  'backlog.idle', 'backlog.missingRequirements', 'running.plan', 'archived.settled',
] as const;
export type TicketStatePath = (typeof TICKET_STATE_PATHS)[number];

states: {
  routing: {
    always: [
      { target: 'backlog.idle', guard: ({ context }) => context.enter === 'backlog.idle' },
      { target: 'running.plan', guard: ({ context }) => context.enter === 'running.plan' },
      // ...one per path
      { target: 'backlog.idle' },   // fallback, unguarded and last
    ],
  },
}
```

Export the path list. The explorer's coverage check compares its scenarios
against it, so adding a state without a screen turns the banner amber.

---

## 2. Parallel regions for independent facts

If two facts can both change without affecting each other, they are regions, not
one enum. Flattening them is the classic bug factory: archiving a thread quietly
marking it read, starring it pulling it out of trash.

```ts
{
  id: 'thread',
  type: 'parallel',
  states: {
    place: { /* inbox | snoozed | archived | trash | spam */ },
    read:  { initial: 'routing', states: { unread: {}, read: {} } },
    star:  { initial: 'routing', states: { off: {}, on: {} } },
  },
}
```

An event a region does not handle does nothing to it — that independence is free
and is worth an explicit assertion in the drive script.

Reading a region's value needs an accessor, since the state value is a record:

```ts
export function placeOf(value: unknown): PlacePath {
  const place = (value as { place?: unknown })?.place;
  if (typeof place === 'string') return place as PlacePath;
  const k = Object.keys(place as object)[0];
  return `${k}.${(place as Record<string, string>)[k]}` as PlacePath;
}
```

**Gotcha:** a parallel machine reaches `status === 'done'` only when *every*
region is final. A region with no final state (window chrome, say) keeps the
actor alive forever. That is usually correct — but it means the parent must
prune the child (pattern 6).

---

## 3. Undo windows are states, not timers

Anything with an Undo affordance is a delayed transition out of a short-lived
state.

```ts
archived: {
  initial: 'settled',
  states: {
    justMoved: {
      after: { undoWindow: 'settled' },
      on: {
        // Guarded per origin, because Undo must return it where it came from.
        UNDO: [
          { target: '#thread.place.inbox', guard: cameFrom('inbox') },
          { target: '#thread.place.spam.settled', guard: cameFrom('spam') },
        ],
      },
    },
    settled: {},
  },
}
```

**Put `UNDO` on `justMoved`, not on `archived`.** On the parent it stays accepted
forever and the window is decorative. This exact bug shipped once and was caught
only by an assertion that `can({type:'UNDO'})` is false after the window closes.

If a parent also shows an "Undo" toast, make the toast's lifetime **shorter**
than the child's window (e.g. 4500ms vs 5000ms). Otherwise the button outlives
the window and silently does nothing.

---

## 4. Undo Send / point of no return

The same shape, applied to an outbound action. The value is that "undo" is a
plain transition, because nothing has been handed to the server yet.

```ts
sending: {
  after: { undoSend: 'transmitting' },
  on: { UNDO_SEND: 'editing.dirty' },
},
transmitting: {
  // No UNDO_SEND handler exists here, so the button cannot be rendered.
  invoke: { src: 'transmit', onDone: 'sent', onError: 'sendFailed' },
},
```

---

## 5. Debounce is a re-entered state

Re-entering a state resets its `after`. That is the whole debounce.

```ts
editing: {
  initial: 'clean',
  states: {
    clean: {},
    dirty: { after: { autosave: '#compose.doc.saving' } },
  },
  on: { EDIT: { target: '.dirty', actions: 'applyEdit' } },
}
```

---

## 6. Child actors: spawn, sync, prune

Spawn from the parent's `setup({actors})` registry by name, not by passing the
machine:

```ts
setup({ actors: { thread: threadMachine } })
// ...
assign(({ context, spawn }) => ({
  threads: [...context.threads, spawn('thread', {
    id: `thread-${t.id}`,
    syncSnapshot: true,     // see below
    input: { thread: t },
  })],
}))
```

`syncSnapshot: true` makes the child's snapshot changes arrive at the parent as
events. That is what lets a parent's eventless transition re-evaluate a guard
that reads children — no polling, no hand-maintained counter:

```ts
attachmentsPending: {
  always: {
    target: 'sending',
    guard: ({ context }) =>
      !context.attachments.some((a) => a.getSnapshot().matches('uploading')),
  },
}
```

Prune finished children with a **guarded** `always` so it cannot loop:

```ts
always: {
  guard: ({ context }) => context.children.some(isFinished),
  actions: assign({ children: ({ context }) => context.children.filter((c) => !isFinished(c)) }),
}
```

This is also how a cancelled draft leaves nothing behind: the child reaches
`cancelled`, the parent drops it, and there is no "is the box open" boolean to
leak.

---

## 7. Cross-actor facts are pushed down, never pulled

A child must not reach across to a sibling or up to a parent. The parent
reconciles and sends an event.

```ts
// Parent, after any edit:
reanchorComments: enqueueActions(({ context, enqueue }) => {
  for (const ref of context.comments) {
    const snap = ref.getSnapshot();
    const intact = anchorIsIntact(body, snap.context.anchor);
    if (!intact && !snap.matches('orphaned')) enqueue.sendTo(ref, { type: 'ANCHOR_LOST' });
    if (intact && snap.matches('orphaned'))  enqueue.sendTo(ref, { type: 'ANCHOR_FOUND' });
  }
}),
```

Same shape for `DEPS_CHANGED` (ticket dependencies) and `SET_REVIEWABLE`
(document mode gating whether a suggestion can be accepted). The child owns what
to *do* about the fact.

### If the push-down is a guarded eventless transition, it can spin forever

The common refinement is to guard it — an `always` whose guard asks *"does the
parent disagree with the child?"* and whose action sends the child an event to
close the gap. Written the obvious way it does not merely misbehave, **it
hangs**, with no error and no output.

`sendTo` queues. The guard is re-evaluated as soon as the action has run, and if
the child has not drained the event yet, the guard is still true, so the parent
sends again. Whether it terminates depends entirely on where the chain started:

- the event came from **outside** — the child is idle, takes it immediately, the
  guard goes false, and the pattern appears to work;
- the chain started **inside that child** — its mailbox is still draining its own
  event, the parent's message queues behind it, and the parent spins.

So a machine written this way is correct only by luck of origin, and the luck
runs out the first time an interaction begins at the child. It cost one build a
hang on its very first send, and a second build had the identical shape sitting
latent because its only trigger happened to be a parent-level event.

**The rule: guard on a value the parent itself owns and updates in the same
action** — a recorded `pushedX`, a monotonic counter. Reading the child's
snapshot to decide whether to write to the child is the trap.

```ts
// context: { viewer, pushedViewer }
always: [{
  guard: ({ context }) => context.pushedViewer !== context.viewer,
  actions: enqueueActions(({ context, enqueue }) => {
    for (const ref of liveChildren(context)) {
      enqueue.sendTo(ref, { type: 'VIEWER_CHANGED', viewer: context.viewer });
    }
    enqueue.assign({ pushedViewer: context.viewer });   // <- what terminates it
  }),
}],
```

---

## 8. Guards with a fallback, so a refusal explains itself

A guard that just fails swallows the click. Give the refusal a state.

```ts
START: [
  { target: 'starting', guard: 'canStart' },
  { target: '.missingRequirements', actions: assign({ startRefusal: /* why */ }) },
],
// ...
missingRequirements: {
  after: { refusalTimeout: 'idle' },
  exit: assign({ startRefusal: null }),
},
```

**Consequence worth knowing:** `snapshot.can({type:'START'})` is now always true,
because the fallback is unguarded. Do not bind a `disabled` attribute to it —
that binding will never fire. Compute readiness from the same predicate the
guard uses, and demote the button rather than disabling it.

---

## 9. Dynamic delays

`delays` entries can be functions of context. Snooze durations, backoffs.

```ts
delays: {
  undoWindow: 5000,
  snoozeDelay: ({ context }) => context.snoozeMs,
},
// ...
snoozed: {
  after: { snoozeDelay: { target: 'inbox', actions: raise({ type: 'MARK_UNREAD' }) } },
}
```

Note the `raise` — waking should also mark unread, but that lives in a different
region, so it goes back through the event queue rather than reaching sideways.

**Always name delays.** Numeric literals in `after` cannot be overridden by
`.provide()`, so the explorer cannot freeze them.

---

## 10. Named actions with params

Actions declared in `setup({actions})` cannot narrow the event type. Use params,
which may be computed from the event at the call site.

```ts
setup({
  actions: {
    applyEdit: assign((
      { context }: { context: DocumentContext },
      params: { body: string },
    ) => ({ /* ... */ })),
  },
})
// ...
actions: [{ type: 'applyEdit', params: ({ event }) => ({ body: event.body }) }]
```

Helper functions that call bare `assign()` outside `setup()` lose the machine's
event type and produce a wall of `_out_TEvent` errors. Put them in
`setup({actions})` instead.

For handlers that read a *specific* event, write the `assign` inline in the
transition — there the event is narrowed correctly:

```ts
SET_MODEL: { actions: assign({ ticket: ({ context, event }) => ({ ...context.ticket, model: event.model }) }) },
```

---

## 11. Freezing a machine for the explorer

Never write a second copy. `provide()` swaps effects and delays while keeping
states, guards and transitions identical.

```ts
// 2³¹−1, and NOT Number.MAX_SAFE_INTEGER. setTimeout stores its delay in a
// 32-bit signed integer, so anything larger overflows and is clamped to 1ms:
// a state "frozen" that way advances immediately, in front of the reader, and
// it reads as a broken explorer rather than a wrong constant. This recipe
// shipped with MAX_SAFE_INTEGER and cost a real debugging session.
const FOREVER = 2_147_483_647;
const frozen = ticketMachine.provide({
  actors: {
    worker: fromCallback(() => undefined),
    attachSession: fromPromise(() => new Promise<void>(() => {})),
  },
  delays: { undoWindow: FOREVER, refusalTimeout: FOREVER },
});
```

Never-settling promises park `starting` / `merging` / `posting`. Frozen delays
stop self-dismissing states sliding out from under the reader.

Add a `seed?: Partial<Context>` to the machine's input and spread it last in the
context factory, so a scenario can supply the data that makes a state honest:

```ts
context: ({ input }) => ({ /* defaults */, ...input.seed }),
```

---

## 12. Transition log for free

An inspector sees every actor in the system, including spawned children, so no
machine needs logging in it.

```ts
const inspect = (ev: InspectionEvent) => {
  if (ev.type !== '@xstate.snapshot') return;
  const id = (ev.actorRef as { id?: string }).id ?? 'anonymous';
  const snap = ev.snapshot as { value?: unknown };
  if (snap.value === undefined) return;      // promise actors have no state value
  const to = toPath(snap.value);
  const from = last.current[id];
  last.current[id] = to;
  if (from === undefined || from === to) return;   // context-only update
  log.current.push({ actor: id, event: ev.event.type, from, to });
};

useMachine(machine, { input, inspect });
```

---

## 13. React binding

Children run on their own clocks, so React needs a nudge when any of them moves.

```ts
function useChildRevision(refs: { id: string; subscribe: (fn: () => void) => { unsubscribe(): void } }[]) {
  const [revision, bump] = useReducer((n: number) => n + 1, 0);
  const key = refs.map((r) => r.id).join('|');
  useEffect(() => {
    const subs = refs.map((r) => r.subscribe(bump));
    bump();   // <- see below. Do not delete this line.
    return () => subs.forEach((s) => s.unsubscribe());
  }, [key]);
  return revision;
}
```

**Two failures this prevents, and the second one is the subtle one.**

`syncSnapshot: true` tells the parent machine about its child's transitions,
which keeps the parent's *guards* reading current child state. It does **not**
make React re-render: a synced event no handler acts on leaves the parent's own
snapshot unchanged, so `useMachine` has nothing new to hand React, and a view
reading `ref.getSnapshot()` keeps re-reading the value it first saw. Subscribing
is what fixes that.

Subscribing alone is still not enough. **`useMachine` renders once before it
starts the actor**, so anything a child does *on start* — a parent's eventless
push-down running, a child entering its first real state — has already happened
by the time the effect subscribes, and a subscription only catches what happens
next. On a child that then holds still, nothing happens next: the page renders
exactly one frame too early and stops. That is what the bare `bump()` is for.

Both of these render correctly and are wrong, and neither is visible at the
actor seam — the machine really does transition. They are claims about React, so
they belong in a browser-seam test.

Do **not** memoise the derived views on the parent snapshot. A child transition
is precisely the case where the parent snapshot is unchanged and the views must
be rebuilt anyway, so a memo keyed on it caches the stale answer — which is the
bug this hook exists to fix.

Derive a `View` per child (snapshot, flattened path, and an `accepts` predicate)
and let components read only that. For a single child that updates often, prefer
`useSelector(actorRef, s => s)` so it re-renders alone.

Flattening a nested state value to a dotted path:

```ts
export function toPath(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const k = Object.keys(value as object)[0];
    const tail = toPath((value as Record<string, unknown>)[k]);
    return tail ? `${k}.${tail}` : k;
  }
  return '';
}
```

---

## 14. Determinism

`Math.random()` and a live clock make the states page impossible to compare
between runs, and make seeded data drift. Fix a `NOW` constant, derive
timestamps from it, and use a seeded counter for ids.
