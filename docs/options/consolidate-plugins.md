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

**Six plugins are enabled anywhere; nine are enabled nowhere.** Measured across
`~/.claude/settings.json` and all five project settings files: `create-worktree-friendly`
(cedarpad, games), `worktree-tickets`, `git-clean-stop`, `plugin-version-guard`,
`grill-options`, `machine-first-prototype`. Enabled nowhere: `visual-mode`,
`red-sweep`, `create-dev-start`, `claude-config-lint`, `orchestrator`, `intent`,
and the three broken CLI plugins. An earlier claim that "no repo enables more than
three" was wrong — user scope enables five, and user scope applies in every project
on the machine.

**`claude plugin list` reports `Status: ✘ failed to load`.** A broken plugin
installs successfully and then fails to load, and the status field says so. It has
presumably been saying so about the three CLI plugins since 2026-04-15. Nothing in
this repo has ever looked at it — a fourth cheap check nobody runs.

**A live skill points at a cull target.**
`plugins/create-worktree-friendly/skills/create-worktree-friendly/SKILL.md:131`
tells users to "use `create-dev-start` separately". That plugin is pinned by three
tracked settings files; `create-dev-start` is enabled nowhere.

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

## Option 3 — Cull to what you actually use, and archive the rest

**Thesis:** nine dead directories leave `plugins/`, the storefront stops
misreporting its own survivors, and one live dangling pointer is repaired. The
shorter list is the visible consequence, not the point.

**The diff (the one pinned answer that defines this option):**
- **Everything enabled nowhere is unlisted**, not just what is broken.

**Outcome:** one atomic commit. Nine entries are unlisted and their directories
`git mv`d to `archive/`, which is explicitly a graveyard: `archive/README.md`
states the contents are as-of that commit, unverified, and that reviving one means
re-validating it. `README.md` is replaced — every plugin it currently documents is
culled — with the marketplace-add line, the personal-shelf framing, the listing
criterion, the six survivors, and a one-line shelf index of the nine removals.
`create-worktree-friendly` gets its `0.1.0` manifest, its dangling `create-dev-start`
line is edited out, and it bumps to `0.1.1`. `version` is dropped from all six
surviving entries, which is legal precisely because this commit writes the manifest
that made it unsafe.

**Impact:** touches `marketplace.json`, both READMEs, nine directory paths, and one
survivor's manifest and skill text. Verified address-neutral for five of six
survivors; the single address change is `create-worktree-friendly` moving to
`.../0.1.1/`, and cedarpad and games pin it by name, so both re-resolve. Effort:
an afternoon, mostly prose. Reversible via `git mv` back.

**Pros**
- The only option with a measurable effect on the primary metric: nine directories
  stop being guard surface and stop being read by every agent that greps the repo.
- Fixes two storefront lies that `claude plugin validate` reports today —
  `machine-first-prototype` is advertised at 0.1.0 while every installed copy is
  0.4.0 — and eliminates the drift class permanently rather than resetting it.
- Repairs the one genuine dangling pointer, in the plugin three tracked settings
  files depend on.
- The rule is applied consistently, including to `intent` — the heaviest runtime in
  the repo, never enabled anywhere — which a hand-picked list would have spared.

**Cons**
- **It consolidates nothing.** The user's word was "consolidate"; this option only
  subtracts. `worktree-tickets` and `create-worktree-friendly` both scaffold
  worktree workflows; `git-clean-stop` and `plugin-version-guard` are both small
  commit-time hooks. Both pairs are left untouched, and cannot be merged while
  hooks activate per-plugin.
- **It cleans up an accumulation and does nothing about the accumulating.** Nine of
  fifteen entries became cull-worthy through an unchanged pattern: write a plugin,
  commit it, list it, never enable it. In twelve months there will be more.
- Culling on enablement derives a committed public file from one laptop's mutable
  settings. The criterion has to be restated as an author's judgement to be durable.
- It cancels the trio's repair. Fixing plugins the rule keeps unlisted forever is
  work with no consumer — so this option overrides the disposition Option 1 pins,
  and archives them broken.

**Rule coverage is six of nine, and the option says so.** `x-cli`, `google-cli` and
`gemini-image` were installable all along — install succeeds, the plugin then fails
to load — so their non-enablement is partly the defect's own doing. The rule carries
the other six on its own strength; the trio is culled on staleness plus a
demonstrated load failure. Stating the split is what keeps this a rule applied
consistently rather than a hand-picked list wearing a rule's clothes.

**Wrong if:** you want this marketplace to be something other people use. The whole
criterion is "enabled nowhere *by me*", on a public repo anyone can add. Under a
public reading, `red-sweep` — a self-contained, hook-free skill at 1.0.0 — becomes
unavailable to an outside consumer solely because its author has not switched it on
lately, and the predicate is simply wrong.

**Close calls**
- Deleting the nine outright rather than archiving them, which is house style
  (`pm-agent`, `e04f5d6`). Archiving wins because it neither loses the author's work
  nor keeps the friction; git history is a worse index than a directory an agent
  will grep.
- Leaving the dangling `create-dev-start` line rather than forcing this option's
  only version bump.
- A shelf that stays valid rather than a graveyard. Rejected because a shelf that
  must keep working is maintenance surface with a new path — the exact thing this
  option removes.

---

## Fork points, and the one not grilled

| | Pinned in Option 1 | Alternative | Status |
| --- | --- | --- | --- |
| FP1 | Fix the broken trio, keep in `plugins/` | Delete the directories outright | **Folded — see below** |
| FP2 | A hard-failing pre-commit gate | No gate; convention in `CLAUDE.md` | Grilled → Option 2 |
| FP3 | Unlist only what is broken | Unlist everything enabled nowhere | Grilled → Option 3 |

**FP1 was folded rather than grilled, deliberately.** Option 3 archives the trio
unfixed, which already removes them from `plugins/`, from the guard's path and from
every agent's grep. A delete-outright variant would differ from that only in
whether `archive/` exists — same directories gone, same recovery through git, and
no distinct kill criterion worth putting to a decision. The method's own rule is to
merge a variant that is not actually distinct, so the fourth session was not spent.
What FP1's alternative buys is recorded where it belongs: under Option 1, deleting
the trio would dissolve the `.plugin-gate.json` exception list entirely, since
"anything in `plugins/` without an entry is an error" becomes enforceable with no
exceptions.

## These are not three mutually exclusive plans

Two independent axes, not one. **FP2 (gate or no gate)** separates Option 1 from
Option 2. **FP3 (how much to cull)** produces Option 3, which composes with either.
So the real choice is a pair:

| | Conservative cull (12 entries) | Aggressive cull (6 entries) |
| --- | --- | --- |
| **Gate exists** | Option 1 | Option 1 + Option 3 |
| **No gate** | Option 2 | **Option 2 + Option 3** |

One interaction to know: under Option 2, `plugin-version-guard` is deleted. It is
currently a survivor of Option 3's cull, so combining them takes the storefront to
five entries, not six.

## Comparison

| | Option 1 — gate | Option 2 — convention | Option 3 — cull |
| --- | --- | --- | --- |
| Entries after | 12 | 12 | 6 |
| Directories in `plugins/` | 15 | 15 | 6 |
| Per-commit friction | adds a gate where today there is none | none | none |
| New machinery | gate script, exception config, pre-flight, `--dry-run` | one `CLAUDE.md` | none |
| Effect on the primary metric | negative (adds friction) | neutral | positive (9 directories leave) |
| Fixes today's `validate` warnings | yes | no | yes |
| Fixes the dangling pointer | no | no | yes |
| Deadlock risk with `git-clean-stop` | yes, mitigated | none | none |
| Effort | a day | half a day | an afternoon |

## Recommendation

**Option 3, executed with Option 2's stance on enforcement.** Cull to what you use,
archive the rest, delete the guard, and write the convention down.

The reasoning, in the order the grilling produced it:

1. **Option 3 is the only one with a measurable effect.** The version guard never
   reads `marketplace.json`, so unlisting changes friction by zero — but moving nine
   directories out of `plugins/` takes them out of the guard's path, out of every
   agent's grep, and out of the loader's view. It also fixes the two storefront
   lies `validate` reports today and the one live dangling pointer. Options 1 and 2
   fix none of those.
2. **Option 1 loses on its own metric.** The friction it claims to redirect does not
   exist in this clone — the guard has never fired here — so it adds friction rather
   than trading it, and pays for that with an exception config, a pre-flight check,
   a `--dry-run` flag and a generated script to keep in sync. It also creates the
   `git-clean-stop` deadlock it then has to defuse.
3. **Option 2 wins the enforcement question on evidence, not preference.** A gate
   existed for four months, was inert, nobody noticed, and the drift accumulated
   anyway. An enforcement mechanism nobody installed is worth less than a convention
   every session reads — and `CLAUDE.md` is read by an agent that is already inside
   the session that made the change.

**What would change my mind:** if plugin edits in this repo routinely happen
outside a Claude session, Option 2's mechanism is a person remembering rather than
an agent checking, and this repo has already shown what that produces — in which
case Option 1's gate earns its friction. And if you want this marketplace to be
something strangers use, Option 3's whole predicate ("enabled nowhere by me") is
the wrong test and the cull should be reduced to what is broken.

**One open verification, worth a glance before you commit to anything:** open
`/plugin`, browse the marketplace, and see whether an entry with no `description`
falls back to the manifest's. Validation, install and `claude plugin details` all
do. If the storefront does too, entry `description` is deletable and the
description-matching invariant ceases to exist rather than becoming a rule nobody
checks.

## Open close calls

- Native `claude plugin validate` vs this repo's `claude-config-lint` as any gate's
  engine — the local validator independently catches the trio's bug but misses the
  version drift, and its project mode does not walk `plugins/`.
- Removing manifest `version` fields entirely, so every plugin is content-hash
  addressed and every commit auto-delivers. Proven to work; rejected only because it
  destroys the human-legible signal of what changed.
- Whether `claude plugin list`'s `Status: ✘ failed to load` should become a checked
  invariant. It has been reporting the trio's breakage since April and nothing has
  ever read it.
- Whether the storefront is a personal shelf or a public offering. Answered as a
  shelf on the evidence, and it is Option 3's `Wrong if`.
