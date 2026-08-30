# Options: consolidating the plugins

Subject, verbatim: **"opportunity to consolidate plugins"**

Produced by `/grill-options`. A grilling subagent walked the design tree over four
rounds; answers came from this repo and from live experiments against the Claude
Code CLI. Two fork axes survived the gates; a third candidate was withdrawn as
common ground.

## What grilling established before any option

These hold under every option below.

**The premise "consolidate plugins" mostly does not survive contact with the repo.**
The two things "consolidation" normally means both evaporated:

- *Merge plugins into kits.* Plugin hooks activate on enable, with no per-component
  opt-in. A kit forces its hooks on anyone who wanted one skill from it. That kills
  the worktree kit (cedarpad enables `create-worktree-friendly`, which has zero
  hooks, and would silently gain a `PreToolUse` hook) and the CLI kit (three
  `SessionStart` hooks).
- *Dedupe shared plumbing.* The only real duplication is the NestJS/bun `packages/`
  shape across `x-cli`, `google-cli` and `gemini-image` — which are precisely the
  three plugins every option unlists. The shared-plumbing work has no live
  beneficiary. What remains is five trivial shell scripts.

**There is almost no coupling to consolidate.** In the repo's entire history only two
commits touched more than one plugin directory, and one of those was a mechanical
`skills:` path fix across five (`ebb0c0f`). Nine of fifteen plugins have not been
touched since April 2026.

**The dead set is real.** Zero enablement in any settings file and zero invocation
evidence: `visual-mode`, `red-sweep`, `create-dev-start`, `gemini-image`,
`google-cli`, `x-cli`, `claude-config-lint`. `orchestrator` is borderline — one
history mention, no enablement.

Those three CLI plugins are also the marketplace's entire advertised identity:
`README.md:3` still reads "CLI tools for Claude Code — Twitter, Google Workspace,
and Image Generation", and the README documents 3 of 15 plugins.

**Consumers exist, and they are committed files.** `Zabaca/agent-tools` is public
with 0 stars, 0 forks, 0 watchers. But `cedarpad/.claude/settings.json` enables
`create-worktree-friendly@zabaca-agent-tools`, and this repo's own
`.claude/settings.json` enables three more. Those files are checked in, so every
clone inherits the identifiers, and a broken identifier fails silently.

**Common ground in every option:** unlist the dead set from `marketplace.json` while
keeping the code in git; generate the README from `marketplace.json` plus each
manifest; add a validation gate (`claude plugin validate` across all plugins, plus
marketplace-entry/manifest agreement and README freshness); name the marketplace
honestly as a personal toolkit in `README.md:3`; and hand-review the eight surviving
`description` strings. That last item is small but not automatic: generating the
README from those fields makes them load-bearing, and they are also what a person
reads in `/plugin` before installing. None of the eight has ever been graded.

## Facts established by experiment

Four questions were settled by running the CLI rather than reasoning about it.

| Question | Result |
| --- | --- |
| Can two marketplace entries point at one plugin directory? | Yes — both validate, install, and enable |
| Does an alias double-charge always-on tokens? | No — identity is the manifest `name`; `details thing-old` reports "not found" |
| Do aliased hooks fire twice? | No — SessionStart hook fired exactly once with both entries enabled |
| Does the guard kit re-impose the ceremony `(d)(ii)` removes? | No — `plugin-version-guard` is skill-only, `user-invocable`, scaffolds only on invocation |

The alias finding cuts both ways, and the second edge matters more: an alias does
not *preserve* the old plugin, it *redirects* the old name at the merged one. A
stale key that stops resolving is discoverable; a key that silently grows a
`PreToolUse` hook is not.

## Option 1 — Honest list

**Thesis:** the marketplace stops lying about what it contains, and the version
ceremony goes with the plugins that needed it.

**The diff:** the version-bump guard is removed from this repo in the same commit
that lands the validation gate. `plugin-version-guard` stays published for other
people's repos; it just stops being enforced here.

**Outcome:** `marketplace.json` lists 8 plugins instead of 15. `README.md` is
generated and accurate. Every commit touching `plugins/` runs a gate that fails if a
plugin directory changed without its marketplace description or README entry being
regenerated. `.husky/check-plugin-versions.sh` is gone, so editing a plugin no
longer requires a manifest bump.

**Impact:** touches `marketplace.json`, `README.md`, `.husky/`, and adds one gate
script. No plugin directory moves, no identifier changes, nothing any consumer has
to edit. Effort: hours. Fully reversible — the unlisted plugins are one JSON block
away from returning.

**Pros**
- Removes friction that fires on every plugin commit, in exchange for a check that
  catches what actually broke (a four-month-stale README).
- The gate is a superset of the guard: the version guard structurally could not
  catch stale docs, because it only knows a file was staged.
- No consumer-visible change at all — nothing to migrate, nothing to announce.

**Cons**
- Versions freeze at whatever they are, permanently. If this marketplace ever gets
  real external consumers, semver has to be reintroduced from a standing start.
- Deletes the only automated check that fires today before its replacement has been
  proven in practice.

**Wrong if:** you intend to promote this marketplace publicly. The moment strangers
install from it, a version number is the only channel you have to tell them
something changed.

**Close call:** the gate runs through `claude plugin validate` rather than this
repo's own `claude-config-lint`. The native CLI tracks the real schema; the local
Zod validator has already drifted (it rejects `disable-model-invocation`, a valid
key shipping in `mattpocock-skills`).

## Option 2 — Released toolkit

**Thesis:** the same cleanup, but the marketplace is treated as a thing with
releases.

**The diff:** the version-bump guard stays, and a changelog is added per plugin. The
enforceable rule is "every change bumps patch"; meaning lives in the changelog.

**Outcome:** identical to Option 1 for the list, README, and gate. Additionally,
each surviving plugin gets a `CHANGELOG.md`, `.husky/check-plugin-versions.sh`
stays, and every plugin edit costs a bump plus a changelog line.

**Impact:** everything Option 1 touches, plus 8 new changelog files and a stated
bump rule. Effort: a day, and a recurring per-commit tax thereafter. Reversible, but
the changelogs rot if abandoned.

**Pros**
- If external consumers ever appear, the communication channel already exists rather
  than needing retrofitting.
- A changelog is the artifact that would let you reconstruct why a plugin changed —
  something git history technically holds but nobody reads.

**Cons**
- The rule the existing script can enforce is the meaningless one. It only knows a
  file under `plugins/<name>/` was staged, so "every change bumps patch" is the only
  option; `machine-first-prototype` reaches 0.40.0 by winter and the number still
  tells nobody anything.
- The real deliverable is therefore the changelog, hand-written, for an audience of
  three of your own repos.
- Four months of a README documenting 3 of 15 plugins is direct evidence about
  hand-maintained prose in this repo.

**Wrong if:** the audience stays what it is today. Versioning exists to talk to
consumers you cannot reach by editing a file — and you can reach all of yours by
editing a file.

## Option 3 — Honest list plus a guard kit

**Thesis:** Option 1, and the one merge that survives every rule gets made.

**The diff:** `git-clean-stop` and `plugin-version-guard` merge into a single
repo-guard plugin, with the two old names kept as aliases pointing at the merged
directory.

**Outcome:** Option 1's end state, minus one line in this repo's
`.claude/settings.json`. Both old `@zabaca-agent-tools` identifiers keep resolving
indefinitely, at no token cost and with no doubled hook firing.

**Impact:** one directory merge, two alias entries in `marketplace.json`, and this
repo's settings updated. cedarpad is untouched. Effort: an hour on top of Option 1.
Reversible, though unwinding the alias is awkward — the CLI addresses plugins by
manifest name, so the alias name is not addressable by `details` or `uninstall`.

**Pros**
- It is the only merge whose inherited hooks are the product rather than a side
  effect: a kit that means "hold this repo to a standard" is *bought* for its hooks.
- The two members are already co-enabled in the one repo that would install it.
- Aliasing makes it a soft migration — tested, not assumed.

**Cons**
- Marginal value is one fewer install line in one repo, against a merge, an alias,
  and a permanently non-addressable alias name.
- Combining with Option 2 rather than Option 1 is coherent but odd: the kit ships a
  version-guard scaffolder to other people while you keep enforcing it here by hand.
- The kit wanted a third member — `claude-config-lint` — and could not have one
  without contradicting the decision to unlist the dead set. A kit that needs a
  third member to feel like a kit is a rationalization.
- Its only named consumer has already installed both members. A kit is a
  convenience for a *future* installer, and the one install line it saves is
  already written.

**Wrong if:** no second repo is going to adopt the hygiene hooks. This option rests
entirely on a fact about your intentions that the repo cannot answer — if cedarpad
(or a next project) will take the guards, the kit is justified; if the consumer base
stays one settings file that is already correct, this is a net-negative refactor and
belongs in the eliminated table with the other two kits.

**Close call:** whether the guard kit is worth doing at all was the last live
question in the grilling, and it survived on one argument — that hook inheritance is
legitimate when the hooks *are* the product.

## Comparison

| | Option 1 — Honest list | Option 2 — Released toolkit | Option 3 — plus guard kit |
| --- | --- | --- | --- |
| Marketplace entries | 8 | 8 | 7 + 2 aliases |
| Per-commit friction | gate only | gate + bump + changelog | gate only |
| New files to maintain | 1 gate script | 1 gate script + 8 changelogs | 1 gate script |
| Consumer-visible change | none | none | identifiers merge (aliased) |
| Effort | hours | ~a day, plus recurring | hours + ~1h |
| Reversibility | full | full, changelogs rot | awkward alias unwind |

## Eliminated, with the question that killed each

| Eliminated | Killed by |
| --- | --- |
| Worktree kit (`worktree-tickets` + `create-worktree-friendly` + `orchestrator`) | An alias redirects rather than preserves, so cedarpad's checked-in key would silently start loading a `PreToolUse` hook it never asked for |
| CLI kit (`x-cli` + `google-cli` + `gemini-image`) | Three inherited `SessionStart` hooks for anyone who wanted one skill — and all three are in the dead set anyway |
| Shared-plumbing dedup | Its only instances are the three plugins every option unlists; no live beneficiary remains |
| "Reduce always-on token cost" as the driver | No project enables more than three of these at once; there is no context tax to relieve |

## Recommendation

**Option 1.**

The grilling changed what the question was. "Consolidate plugins" implied merging
directories or deduping code, and both died on their own merits — hooks make kits
coercive, and the only duplicated code belongs to plugins nobody runs. What is
actually consolidatable is the marketplace's honesty: its list, its descriptions,
its README, and what checks them.

Option 2 loses to Option 1 because the only bump rule the existing script can
enforce is the one that carries no information, which makes the real deliverable a
hand-written changelog for an audience of your own three repos — and this repo has
four months of evidence about hand-maintained prose.

Option 3 is defensible and cheap, but it is an increment on Option 1 rather than a
rival to it, and its marginal value is one install line.

**What would change my mind:** evidence of real external consumers. If someone other
than you installs from this marketplace, Option 2's version channel stops being
ceremony and Option 3's identifier merge stops being cheap. The 12 clones / 10
uniques in the last 14 days are consistent with Claude Code's own marketplace
fetches, but they are not proof of absence.

## Open close calls

- Native `claude plugin validate` vs this repo's `claude-config-lint` as the gate's
  engine.
- Fully generated README vs a generated index with hand-written prose per plugin.
- One marketplace vs splitting along the hooks-versus-skills seam. This was closed on
  the fork budget, not on the merits, and it is the close call most worth reopening:
  the grilling rediscovered that seam three separate times, because hooks are exactly
  what cannot be safely merged and skills are exactly what can. If this marketplace
  ever splits, that is the line. Answered as one marketplace because a split doubles
  `marketplace add` friction across your own repos.
- Whether `orchestrator` belongs in the dead set. One history mention, no
  enablement.
