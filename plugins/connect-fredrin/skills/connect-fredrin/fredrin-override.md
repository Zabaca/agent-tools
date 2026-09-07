# FREDRIN.md override paragraph

Goes in the `## Team guidelines` section of the repo's **tracked**
`.fredrin/FREDRIN.md`. That section exists to be customised; everything above it
is Fredrin's injected default and should be left alone.

Fill in the repo's real paths. Keep it short — it is read by every Worker on
every ticket.

---

## Template — repo with no concepts layer (the common case)

```markdown
**This project's memory folder is `docs/` (set in project settings), not the
default `.fredrin/memory/`.** Decision records live in `docs/adr/` (sequentially
numbered, short — see existing entries), and the domain glossary is the root
`CONTEXT.md`. Wherever this file's prose says `.fredrin/memory/…`, read `docs/…`
instead. There is exactly one ADR home — never create `.fredrin/memory/adr/`.

**This repo has no concepts layer.** Durable domain knowledge is the glossary
plus the ADRs: a term belongs in `CONTEXT.md`, a decision in `docs/adr/`. Do not
create a concepts directory, and do not file a concept doc — if
`context-classify` wants one, the term goes in `CONTEXT.md` instead.
```

## Template — repo with a concepts layer

```markdown
**This project's memory folder is `docs/` (set in project settings), not the
default `.fredrin/memory/`.** Decision records live in `docs/adr/`, concept docs
in `docs/concepts/`, and the domain glossary is the root `CONTEXT.md`. Wherever
this file's prose says `.fredrin/memory/…`, read `docs/…` instead. There is
exactly one home for each — never create `.fredrin/memory/adr/` or
`.fredrin/memory/concepts/`.
```

## Template — multi-context repo (`CONTEXT-MAP.md`)

Fredrin can only name one glossary and one ADR home, so this paragraph carries
the rest of the map itself. Adapt the context list to the repo.

```markdown
**This project's memory folder is `docs/` (set in project settings), not the
default `.fredrin/memory/`.** Wherever this file's prose says
`.fredrin/memory/…`, read `docs/…` instead. Never create `.fredrin/memory/adr/`.

**This repo is multi-context.** [`CONTEXT-MAP.md`](../CONTEXT-MAP.md) is the
index: it names each context and points at that context's own `CONTEXT.md`. The
root `CONTEXT.md` is the system-wide frame that sits above them.

**Your context pack covers the root only.** It resolves the root `CONTEXT.md` and
`docs/adr/*`, and nothing under the per-context directories. So before you touch
a package, read that package's own `CONTEXT.md` and its `docs/adr/` yourself —
nothing will hand them to you, and the glossary that governs your code is the
one in that package, not the root.

**Two ADR homes, and the choice is yours to make deliberately.** A decision that
spans the system goes in the root `docs/adr/`. A decision confined to one context
goes in that context's `docs/adr/`. When in doubt, ask — filing a
context-specific decision at the root is how the per-context homes quietly stop
growing.

**This repo has no concepts layer.** A term belongs in the relevant
`CONTEXT.md`; a decision in the appropriate `docs/adr/`. Do not create a
concepts directory.
```

---

## Why each sentence is there

- **Naming the setting** tells a Worker the override is deliberate, not a stale
  note someone forgot to delete.
- **The blanket rewrite rule** ("wherever this file says…") catches the paths in
  the injected default that this paragraph doesn't enumerate. Without it you are
  relying on having listed every one.
- **"There is exactly one ADR home"** is the sentence that actually prevents the
  split. The setting alone changes what Workers *read*; this changes what they
  *write*.
- **Declaring the concepts layer absent** stops `context-classify` filing into a
  directory that does not exist. A dangling `conceptsDir` is silent — nothing
  errors, the doc just has nowhere to go.
- **In a multi-context repo, naming the map and the second ADR home** is the only
  way that structure reaches a Worker. Fredrin's setting cannot express it, and
  the context pack silently omits it, so a paragraph is the whole mechanism.

Add the repo's own conventions after this — coding standards, definition of done,
branch naming. Keep app-domain knowledge (glossary, decisions) in `CONTEXT.md`
and `docs/adr/`, not here: this file is about how to operate, not about the
domain.
