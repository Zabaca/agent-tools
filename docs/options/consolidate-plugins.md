# Options: consolidating the plugins

Subject, verbatim: **"opportunity to consolidate plugins"**

Produced by `/grill-options` v0.2.0. This supersedes the version committed in
`4c7fd75`, which was produced by v0.1.0 and contained a false central claim (it
asserted every plugin passes `claude plugin validate`; three do not). The earlier
document is preserved in git history.

Method: a grilling subagent establishes its own facts from the repo, then
interviews the main thread in rounds. Variant 1 took six rounds. Where a question
was a genuine value trade-off the brief did not settle, the recommended answer was
pinned and the alternative recorded as a fork point for a later variant.

---

## What grilling established before any option

**Three plugins are broken right now.** `x-cli`, `google-cli` and `gemini-image`
each fail `claude plugin validate`: their `hooks.json` opens directly into
`"SessionStart": [...]` with no `hooks` wrapper, so the CLI reports `root:
hooks.json must have 'hooks' … or 'modules'`. Those hooks run `bun install` for
the plugin's dependencies, so it is not established that these plugins have ever
worked on a fresh install. They are also the three the README advertises.

**The version guard has been manufacturing the drift it exists to prevent.**
`.husky/check-plugin-versions.sh` forces a manifest bump when any file under
`plugins/<name>/` is staged. Nothing syncs `marketplace.json`, so entry and
manifest versions have diverged for `worktree-tickets` (0.1.0 vs 0.2.0) and
`machine-first-prototype` (0.1.0 vs 0.4.0). `claude plugin validate .` reports
both, and states the precedence: at install time `plugin.json` wins and the entry
version is silently ignored.

**There are three consumer settings files, not one.** `cedarpad` and
`zabaca/games` both have git-tracked `.claude/settings.json` enabling
`create-worktree-friendly@zabaca-agent-tools`; this repo's own tracked settings
enable three more. A broken identifier fails silently.

**Deletion is house style.** `pm-agent` was removed outright in `e04f5d6`, not
unlisted.

**There is no CI.** No `.github/`, no workflows. `.husky/pre-commit` is the only
automation surface in the repo, so any gate is a pre-commit hook with the same
`--no-verify` bypass as the guard it replaces.

**The version guard has never fired in this clone.** `core.hooksPath` is unset,
`.git/hooks/` holds only `.sample` files, and there is no `node_modules/` —
husky's `prepare` script never ran. The hook is a tracked artifact that enforces
only for whoever ran `bun install`. Variant 1 was answered on the belief that it
was live friction on every plugin commit; it is not, and that correction is why
Option 1's friction argument is weaker than it first appeared.

**Entry `version` is not always ignored.** `plugins/create-worktree-friendly/`
has no `.claude-plugin/` directory at all, and its live cache address is
`~/.claude/plugins/cache/zabaca-agent-tools/create-worktree-friendly/0.1.0/` —
a version that can only have come from the marketplace entry. A scratch
experiment confirms the precedence: manifest, else entry, else content hash
(`package.json` is ignored entirely). So "drop entry `version` everywhere" would
silently re-address the one plugin three tracked settings files pin. Every option
therefore writes a manifest for it first, at `0.1.0`, preserving the address.

**`installed_plugins.json` is not a census of what is loaded.**
`create-worktree-friendly` resolves fully in cedarpad — `claude plugin details`
returns it with its skill inventory — while having no install record at any
scope. Enabling an identifier loads a plugin without writing the record an
explicit install writes.

**Cleanup step common to every option:** this marketplace is currently registered
as a `directory` source pointing at an absolute local path. That is a development
convenience introduced during this session so an unpushed branch could install
without pushing; the canonical registration is the GitHub source, and it should
be restored. Left as-is, tracked settings in other repos resolve only on this
machine.

**Merging is out of scope — and that is the headline finding.** The user's own
word is *consolidate*, and grilling concluded that merging directories is the one
thing that should not happen. No merge reduces per-commit friction; every merge
spends the alias mechanism to buy one install line; plugin hooks activate on
enable with no per-component opt-in, so a kit forces its hooks on anyone who
wanted one skill; and the only plugin with three tracked external pins is the one
that must not move. This is a stated finding, not an omission.

## Facts established by experiment

Run against the live CLI rather than reasoned about.

| Question | Result |
| --- | --- |
| Two marketplace entries pointing at one directory? | Both validate, install, enable |
| Does an alias double-charge tokens or double-fire hooks? | No to both — identity is the manifest `name`; hook fired once |
| Is entry `version` meaningful? | No — an entry of only `name` + `source` validates clean; carrying `version` generates a permanent drift warning |
| Does `claude plugin validate` catch a dangling entry `source`? | **No.** An entry pointing at a nonexistent directory passes silently |
| Does it catch a plugin directory with no entry? | **No.** An orphan directory passes silently |
| Does an unbumped content change reach installed consumers? | **No.** `marketplace update` and `plugin update` both leave the cache stale; only a manifest bump creates a new `cache/<mp>/<plugin>/<version>/` and delivers the change |

The last two rows are the ones that shaped this option. The native CLI does not
check the only invariant that has actually decayed here, and the manifest version
is not decoration — it is the cache address and the sole update trigger.

---

## Option 1 — Fix, unlist, and gate what the CLI misses

**Thesis:** nothing merges and nothing is deleted; the broken things get fixed,
the storefront stops advertising them, and the version ceremony is replaced by a
gate that checks the correspondence no tool checks today.

**The diff (the pinned answers that define this option):**
- The broken trio is **fixed and then unlisted** — code stays in the tree, valid.
- A **hard-failing pre-commit gate** exists.
- **Only broken or superseded plugins are unlisted** — twelve entries survive.

**Outcome:** `marketplace.json` lists 12 plugins, each entry reduced to `name`,
`source` and `description`, with `version` dropped everywhere. The three broken
`hooks.json` files are repaired. A pre-commit gate runs `claude plugin validate`
over staged plugins plus the marketplace, and adds three assertions the CLI lacks:
every entry's `source` resolves, every directory under `plugins/` has an entry
(minus a named exception list), and every entry `description` matches its
manifest. `plugin-version-guard` is rewritten to scaffold this gate instead of the
version check. `README.md` becomes a stub pointing at `/plugin`. The blanket bump
ceremony is gone, replaced by one narrow rule: bump the manifest when published
behaviour changes.

**Impact:** touches all 15 manifests' descriptions, `marketplace.json`, three
`hooks.json` files, `README.md`, `.husky/`, and rewrites one plugin. No directory
moves, no identifier changes, nothing any consumer must edit. Effort: a day.
Reversible, except that the rewritten `plugin-version-guard` is a different
product from the one three repos have installed.

**Pros**
- The gate catches the two failures that silently break a marketplace — a dangling
  entry and an unpublished directory — neither of which the native CLI reports.
- Fixing the trio costs about five lines and converts "unproven, probably broken"
  into "valid but unlisted", which is a defensible thing to keep in a tree.
- Enforcement stops depending on whether a clone ran `bun install` (see the
  correction below): the gate is scaffolded, not left to a `prepare` script.
- Nothing a consumer has pinned changes, so the three tracked settings files
  outside this repo keep resolving.
- Entry `version` disappears, eliminating a whole warning class permanently.

**Cons**
- The gate is per-commit friction, and reducing per-commit friction is the metric
  this work was judged on. It spends the thing it was chosen to improve. Note the
  baseline correction below: today that friction is zero in this clone, so this
  option *adds* friction rather than redirecting it.
- The narrow bump rule is unenforceable — the hook only knows a file was staged,
  not whether behaviour changed — so it depends on the author remembering.
- Keeping the trio in-tree requires a `.plugin-gate.json` exception list, which is
  repo-specific state the scaffolded gate must never clobber. That is real added
  machinery in a marketplace whose stated problem is surface area.
- The rewritten plugin grows a pre-flight check, a `--dry-run` flag and a config
  file it must not overwrite — more surface than the plugin it replaces.

**Stated consequence — this marketplace ships a trap.** `git-clean-stop` exits 2
on a dirty tree, so a session may not stop; a hard-failing gate means it may not
commit. An agent that edits a plugin into an invalid state can do neither, and
both plugins are enabled in this repo's tracked settings. This is accepted, with
two mitigations: the gate prints the failing plugin, the exact validator message
and the file to fix, and does **not** print `--no-verify`; and the scaffolding
skill refuses to install a gate that would reject the repo's own clean tree.

**Wrong if:** you want fewer things on the storefront. This option keeps twelve
entries and adds machinery; it consolidates the repo's *correctness*, not its
size. If "consolidate" meant "I want to see a shorter list", this is the wrong
option and fork point 3 is where that lives.

**Close calls**
- Native CLI as the gate engine rather than this repo's `claude-config-lint` —
  which independently catches the trio's bug, but whose project mode does not walk
  `plugins/` and which missed the version drift entirely. Two tools that already
  disagree, with no stated authority between them, make gate failures ambiguous.
- README as a stub rather than generated. A stub abandons the only place a human
  can read what the marketplace is for.
- The storefront line framed as a personal toolkit rather than neutrally
  functional. `metadata.description` cannot be dropped — the CLI warns when it is
  absent — and today it describes only the plugins being removed.
- The gate is bootstrapped hand-written and back-ported to the plugin once stable,
  rather than dogfooded from the start: because the cache only refreshes on a
  bump, every gate iteration would otherwise be a published behaviour change.


---

## Option 2 — Delete the enforcement, write the convention down

**Thesis:** the gate that existed for four months was inert and nobody noticed, so
enforcement is removed rather than rebuilt, and correctness becomes a checklist
every session reads.

**The diff (the one pinned answer that defines this option):**
- **No plugin-correctness gate exists.** Not "we decline to add one" — the
  existing one is deleted.

**Outcome:** `.husky/`, `package.json`, `bun.lock` and the husky devDependency are
removed, leaving the repo with no node toolchain at the root. `plugin-version-guard`
is unlisted and deleted, which is a five-place migration: the marketplace entry,
the directory, this repo's tracked `.claude/settings.json`, the user's untracked
`~/.claude/settings.json`, and `claude plugin uninstall` at both scopes. A new root
`CLAUDE.md` carries the whole mechanism: the two commands, the bump rule, the three
invariants the CLI provably does not check, the rule that every plugin directory
has a manifest, and the unlisted-but-kept exception list written out by name. Every
session that modifies anything under `plugins/` or `.claude-plugin/` runs that
checklist before it stops. `git-clean-stop` stays — see the boundary below.

**Impact:** deletes four root files and one plugin directory, creates one
`CLAUDE.md`, and reaches twice into untracked global config. Everything else
matches the common ground. Effort: half a day, most of it the migration and the
prose. Reversible in git, except the two global-config steps, which no future
reader can reconstruct from the repo — which is why they are written down before
they are done.

**Pros**
- The strongest evidence in the whole run supports it: the gate existed for four
  months, was inert in this clone, and the drift it was meant to prevent
  accumulated anyway. An enforcement mechanism nobody installed is worth less than
  a convention every session reads.
- The mechanism is stronger than the fork's own wording implied. `CLAUDE.md` loads
  into every session in this repo, and essentially every plugin edit here is made
  by an agent that will have read it. This is agent self-check at the session
  boundary, not a human remembering.
- The `git-clean-stop` deadlock cannot happen. Option 1 ships a trap and spends
  design effort defusing it; this option simply does not have one.
- No exception config file, no pre-flight check, no `--dry-run` flag, no generated
  script to keep in sync. The repo gets smaller in every direction.

**Cons**
- This repo has already run the unenforced-convention experiment. Six months from
  now it looks exactly like today — drifted versions, broken plugins, a
  manifest-less directory, a validator nobody ran — because that state is what an
  unenforced convention produced the first time.
- The convention surface does not exist yet. There is no `CLAUDE.md` anywhere in
  the repo, so the mechanism this option rests on is created by the work itself
  and has never been observed to hold.
- Deleting `plugin-version-guard` is operationally more expensive than rewriting
  it: five places, two of them outside git, for a plugin enabled at both user and
  project scope.
- Once the trio is unlisted, `claude plugin validate .` no longer reaches it, so
  the trio's correctness after the fix is asserted rather than checked. That is the
  option's own thesis applied to itself.

**Stated boundary:** "no gate" means no *plugin-correctness* gate. `git-clean-stop`
stays. It guards against losing uncommitted work, which is a different concern, and
it is the only automation in this repo that actually fires today. Saying this out
loud is required — an option whose claim is honesty about conventions cannot
quietly retain the one enforcement mechanism that works.

**Wrong if:** you will not read your own `CLAUDE.md`. Everything here rests on the
claim that a convention loaded into every session is materially different from one
a person has to remember. If plugin edits in this repo routinely happen outside a
Claude session, that claim is false and this option degrades to the status quo that
produced the current mess.

**Close calls**
- Not fixing the trio at all. If unenforced correctness work is theatre, repairing
  three plugins nobody can install — with nothing to keep them repaired — is the
  purest instance of it. Answered against because five lines converts a
  known-broken parked asset into a known-valid one, and the cost of being wrong the
  other way is discovering it on a consumer's machine.
- Removing manifest `version` fields entirely, so every plugin is content-hash
  addressed and every commit auto-delivers. Proven to work by experiment, and the
  only idea in this run that makes the cache work *for* you rather than around you.
  Answered against because it destroys the only human-legible signal of what
  changed.
- Tying the check to `git push` rather than the session boundary. Rejected because
  nothing enforces push either, so it just moves the unenforced trigger somewhere
  with less knowledge of what changed.

**One open verification.** An entry of `name` + `source` alone validates, installs,
and `claude plugin details` renders the manifest `description`. Whether the
interactive `/plugin` storefront falls back the same way could not be tested — it
is a TUI neither the grilling agent nor I can drive from a shell. If it falls back,
entry `description` is deletable and the description-matching invariant ceases to
exist rather than becoming unenforced prose; the work shrinks from "review 15
manifests and resync 15 entries" to "review 15 manifests, delete 15 duplicates". If
it does not, the duplication stays. One glance at `/plugin` settles it.

---

## Fork points — variants pending

| | Pinned in Option 1 | Alternative to be grilled |
| --- | --- | --- |
| FP1 | Fix the broken trio and keep the code | Delete the three directories outright, as `pm-agent` was |
| FP2 | A hard-failing pre-commit gate | ~~No gate~~ — **grilled, see Option 2** |
| FP3 | Unlist only what is broken (12 entries) | Unlist everything enabled nowhere (8 entries) |

Credit already owed to FP1's alternative: deleting the trio dissolves the
exception list entirely. "Anything in `plugins/` without an entry is an error"
becomes enforceable with no `.plugin-gate.json` and no question about who owns
repo-specific state — a real architectural simplification this option cannot have.

Variants 3–4 to follow, one at a time. The comparison table and recommendation are
written once every variant is grilled to an empty frontier.
