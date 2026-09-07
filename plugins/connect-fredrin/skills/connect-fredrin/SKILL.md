---
name: connect-fredrin
description: Wire Fredrin into a repo that already has Matt Pocock's engineering-skill setup. Points Fredrin's memory folder at the repo's existing docs layout, writes the FREDRIN.md override so Workers read and write the same homes, and repoints docs/agents/issue-tracker.md from GitHub Issues to Fredrin. Also audits a repo that is already half-wired. Use when introducing Fredrin to an existing repo, or when you suspect a repo is split.
disable-model-invocation: true
---

# Connect Fredrin

`setup-matt-pocock-skills` configures a repo's docs layout and issue tracker. This skill is the step after: Fredrin arrives at a repo that already has that layout, and the two must be pointed at each other.

Do not re-run `setup-matt-pocock-skills`. It would rewrite the layout this skill is trying to adopt.

## The failure this prevents

Fredrin exposes a per-project `memory` object — `root`, `adrDir`, `conceptsDir`, `notesDir`, `glossary`, `entryPoints`, `isDefault`. It is **derived, not writable**: `PATCH`ing it returns `validation_error`. The one knob is **`contextRoot`**, and the paths are computed from it — `contextRoot: "docs"` yields `docs/adr`, `docs/concepts`, `docs/notes`; a null `contextRoot` yields the `.fredrin/memory/*` defaults and `isDefault: true`.

Two consequences worth knowing before you start. **`isDefault` is the reliable way to detect an unwired repo** — check it rather than string-matching `root`. And **the derived paths are computed whether or not those directories exist**, so `conceptsDir` and `notesDir` routinely name nothing. You cannot declare "this repo has no concepts layer" through settings at all; the FREDRIN.md override is the only place that can say it.

Setting `contextRoot` changes what Workers **read**: the injected `.fredrin/context-pack-paths.json` starts resolving real `docs/adr/*` files.

It does not change what Workers **write**. The `FREDRIN.md` Fredrin injects into each ticket worktree still tells them to file decisions under `.fredrin/memory/adr/`. So a half-wired repo reads decisions from `docs/adr/` and writes them to `.fredrin/memory/adr/`, giving you two homes, no error, and nothing to notice until they disagree.

The override lives in `.fredrin/FREDRIN.md`, **tracked in git**. Fredrin injects its default per worktree; a tracked copy is how a project states its own paths durably.

## Process

### 1. Audit — read only, write nothing yet

Resolve the project id: `fredrin projects list` and match the repo. Then read the settings:

```sh
fredrin raw GET "projects/<id>"
```

`contextRoot` and `memory` are the fields that matter. Compare them against what the repo actually has, and report a table:

| What | Where to look |
|---|---|
| `contextRoot`, and the derived `memory` paths + `isDefault` | the project record above |
| Decision records | `docs/adr/` — and `.fredrin/memory/adr/`, which must not exist |
| Glossary | root `CONTEXT.md`, or `CONTEXT-MAP.md` for multi-context |
| Concepts | whatever `conceptsDir` names — **usually absent** |
| The override | is `.fredrin/FREDRIN.md` tracked (`git ls-files .fredrin/`), and does it name the repo's paths? |
| Matt's tracker doc | `docs/agents/issue-tracker.md` — does it still say GitHub Issues? |
| Agent-facing entry | `CLAUDE.md` / `AGENTS.md` and their `## Agent skills` block |
| Multi-context signals | root `CONTEXT-MAP.md`; more than one `CONTEXT.md`; more than one `adr/` directory (`find . -type d -name adr -not -path '*/node_modules/*'`) |

State plainly which of these four states the repo is in:

- **Unwired** — `isDefault: true`, `contextRoot` null. Nothing to reconcile; just wire it.
- **Split** — `contextRoot` points at `docs/` but no tracked override. The dangerous one: reads and writes disagree.
- **Wired** — setting and override agree.
- **Multi-context** — a root `CONTEXT-MAP.md` and per-context `CONTEXT.md` files. Fredrin cannot represent this; see below. Wire it and then state the shortfall in the override.
- **Wired but derived paths dangle** — the common residual, and expect *two*: `conceptsDir` and `notesDir` both name directories that usually do not exist, so `context-classify` has nowhere to put a concept doc. Only the override can resolve this.

### 2. Confirm the target layout

One question at a time, recommendation first.

**Decisions.** Default to the repo's existing `docs/adr/`. Never propose moving ADRs that already exist.

**Glossary.** Default to the root `CONTEXT.md` the Pocock setup already established.

**Concepts.** This is the one that needs an explicit answer, because the derived default is a lie in most repos. Ask directly: *does this repo have a concepts layer, separate from its glossary and its ADRs?* Most single-context repos do not — a repo whose durable knowledge is `CONTEXT.md` plus `docs/adr/` should say **no concepts layer**.

Because `conceptsDir` is derived and cannot be pointed elsewhere, there are only two honest resolutions: create the directory the setting already names, or declare the layer absent in the override so `context-classify` stops filing into nothing. Declaring it absent is usually right; creating an empty directory to satisfy a setting is not.

**Notes.** Same shape as concepts — `notesDir` is derived too, and just as often absent. Either use it or say it is unused.

### 2b. Multi-context repos

**Fredrin's model is single-context by construction.** `contextRoot` is one path, so `glossary` is one file and `adrDir` is one directory. A repo with a root `CONTEXT-MAP.md`, per-context `CONTEXT.md` files, and per-context `docs/adr/` directories cannot be expressed in the setting at all — and the failure is silent. Verify it on the repo in front of you: read `.fredrin/context-pack-paths.json` in any ticket worktree and you will see only the root context's files. Nothing from the per-context directories appears, so a Worker on a ticket scoped to one context is handed the *system-wide* glossary and ADRs and none of that context's own.

There is no setting that fixes this. What to do:

**Point `contextRoot` at the root** — the widest useful default, and where system-wide decisions live. Do not point it into one context: that would trade a partial view for a narrower wrong one.

**Then make the shortfall explicit in the override**, because it is the only place that can carry a map. The override must do three things a single-context one need not:

1. Name `CONTEXT-MAP.md` and say it is the index of contexts.
2. Tell Workers that the context pack covers the root only, so before touching a package they must read that package's own `CONTEXT.md` and `docs/adr/` themselves. State it as a requirement, not a suggestion — nothing will remind them.
3. Say **which ADR home a new decision goes in**: system-wide at the root, context-specific under that context. Without this, everything lands in the one directory Fredrin named, and the per-context homes quietly stop growing.

**Also check the derived `glossary`.** It is `CONTEXT.md` regardless of whether that file exists, and the canonical multi-context layout has no root `CONTEXT.md` — so the glossary usually dangles. Resolve it one of two ways, and the choice turns on whether a root `CONTEXT.md` already means something:

- **No root `CONTEXT.md`** → symlink it to the map: `ln -s CONTEXT-MAP.md CONTEXT.md`. The derived glossary then resolves, with no second file to keep in sync. Git stores the symlink (mode `120000`) so it survives clone into every Worker worktree, and it is the same move as pointing `CLAUDE.md` and `AGENTS.md` at one `README.md`. Fredrin follows symlinked entry points — verifiable on any repo that already does this. Layout detection is unaffected: the skills test for the *map's* presence, never for `CONTEXT.md` being absent.
- **A root `CONTEXT.md` that carries its own content** — a system-wide frame sitting above the per-context glossaries, which the map points at as a context in its own right — then leave it alone. Symlinking would destroy real content. The glossary already resolves; nothing to fix.

If you do symlink, make sure the map's opening line says what it is, so a reader who expected a glossary is not confused by what they get.

**Do not flatten the ADRs to satisfy the tool.** Multi-context is a deliberate decision recorded in the repo; a wiring step is not the place to overturn it.

### 3. Migrate, if there is anything to migrate

If `.fredrin/memory/` exists with content, move it into the target layout before wiring, so adoption is not a manual merge later:

- ADRs → the repo's `docs/adr/`, renumbered to continue the existing sequence rather than colliding with it. Read the existing numbers first.
- Concepts → the agreed concepts home, or folded into `CONTEXT.md` if there is no concepts layer.
- Then delete the empty `.fredrin/memory/` so nothing can drift back into it.

Show the user the mapping before moving anything. Never overwrite an existing ADR number.

### 4. Write

**a. Set `contextRoot`** (skip if already correct). Do **not** try to write `memory` — it is derived and rejects a `PATCH`.

```sh
fredrin raw PATCH "projects/<id>" '{"contextRoot":"docs"}'
```

This route answers with an empty body, so it tells you nothing. **Read it back** with `raw GET "projects/<id>"` and confirm both `contextRoot` and the derived `memory` paths. If they did not change, set the memory folder in the desktop app instead and re-read — do not assume the write landed because the command exited 0.

**b. Write the tracked override** into `.fredrin/FREDRIN.md`, in the `## Team guidelines` section — that section exists to be customised. Use [fredrin-override.md](./fredrin-override.md), filling in the repo's real paths. Then make sure it is actually tracked:

```sh
git add -f .fredrin/FREDRIN.md      # -f: .fredrin/ is often gitignored
```

If `.fredrin/FREDRIN.md` does not exist in the repo yet, copy one out of a ticket worktree (`~/.fredrin/worktrees/<repo>.<TICKET>/.fredrin/FREDRIN.md`) and add the section to it, so the tracked copy stays a superset of the injected default rather than a replacement for it.

Never commit the sibling `.fredrin/fredrin` binary or `hooks/` from a worktree — the per-ticket CLI carries a credential. Track `FREDRIN.md` alone.

**c. Repoint Matt's tracker doc.** Overwrite `docs/agents/issue-tracker.md` with [issue-tracker-fredrin.md](./issue-tracker-fredrin.md), which carries the operating rules the Pocock skills need — `to-tickets` in particular, since it defaults to `gh issue` and would otherwise file work in the wrong system.

**d. Update the `## Agent skills` block** in `CLAUDE.md` or `AGENTS.md` (edit whichever exists; never create the other) so its issue-tracker line names Fredrin.

### 5. Verify, then report

Re-read rather than trusting the writes:

- `fredrin raw GET "projects/<id>"` — `contextRoot` and the derived paths hold, `isDefault` is false
- `git ls-files .fredrin/` — the override is tracked
- Every directory named by the derived `memory` paths either exists or is declared absent in the override — `notesDir` too, not just `conceptsDir`
- `.fredrin/memory/` does not exist
- `grep -i github docs/agents/issue-tracker.md` — nothing left over
- Multi-context only: the override names `CONTEXT-MAP.md`, tells Workers to read the per-context files themselves, and says which ADR home a decision belongs in

Then say which of the four states the repo is now in, and what a Worker will do differently. If the repo was split, say so explicitly — that means decisions may already exist in two homes, and the user should check both.
