---
name: consumer-mining
description: Mine the repos that consume your library, template, scaffolder or tool for what it should do next. Separates consumers' real edits from stale copies of your own old code, fans out one agent per consumer, and writes one case per upstream surface with the code (and run history) that proves the need. Sets up a repo-specific survey the first time. Use when deciding what to build next, when consumers keep working around the same thing, or when asked "what do our users actually need".
user-invocable: true
argument-hint: "[consumer ids…]"
---

# Consumer mining

Consumers write your roadmap without meaning to. A helper they wrote because
there was no seam for it, an edit to a file you ship, a shell script that gave
up on your API, a comment saying "X can't do this": each one is a feature
request with a working prototype attached. This reads that record and turns
it into cases, one per **upstream surface** (a module, a command, an API
option), never one per consumer. Nobody acts on "here is what repo A does".
They act on "here is what `http` is missing, from three projects that each
paced the same API by hand".

`${CLAUDE_PLUGIN_ROOT}/skills/consumer-mining/references/worked-examples.md`
has two real setups to borrow from: zbc (an infra framework vendoring modules)
and croft (a CLI that writes agent texts into projects). Read it before
bootstrapping.

## First: is this repo already set up?

Look for `.claude/skills/consumer-mining/SKILL.md` and a consumer registry
(`docs/consumers/registry.json` by convention). If the repo has its own skill,
**follow that one instead of this**. It knows the repo's surfaces, its
collector and its exceptions. This skill only covers the method and the first
setup.

## The mistakes this exists to prevent

**1. Reading your own history back to yourself as feedback.** Anything you
vendor, copy or generate into a consumer (scaffolds, templates, modules, agent
skills, config) drifts from `main` without anyone editing it. Diff it against
`main` and every stale copy looks like a rich fork. So hash every vendored
file against **every git revision** of the file it came from:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/skills/consumer-mining/scripts/ancestry.ts \
  --upstream . --template <path in this repo> \
  [--stamp '<regex for a generated line>' --stamp-as '<the template placeholder>'] \
  <consumer file>...
```

| Verdict | Meaning | Worth a case? |
|---|---|---|
| `current` | your newest revision, verbatim | no |
| `stale` | an older revision, verbatim | no, it's upgrade debt on their side. Note it under distribution |
| `divergent` | matches no revision | **yes**: their edit is a patch already written against your interface. Diff against `nearestRev`, never `main` |
| `removed` | not there | only if removing it means something |

It matches twice, verbatim and normalised (quotes, trailing `;`/`,`,
indentation, blank lines, CRLF). On zbc, crux's `cloudflare` module differed
on every line and scored 0.538 similarity, yet had zero real edits: their
prettier against our biome. Comments are *not* normalised away, because a
consumer's comment is often the finding. Use `--stamp` for any line your
generator fills in (a version stamp, a project name), or every copy will be
divergent on that line alone. On zbc's first run this removed 76% of the
corpus, including the two loudest "forks".

**2. Treating a parallel implementation as a fork.** `divergent` assumes they
edited your file. That's false when your file is the younger one: a module
promoted upstream *from* a consumer, or one they wrote before yours existed.
Compare `upstreamFirstSeen` with `consumerFirstSeen`. When the consumer's file
is older, the diff is a **convergence comparison**: where the two agree is the
interface.

**3. Reporting a gap `main` already closed.** Their divergence is real, but
their *reason* can be as stale as the code they forked. For every finding,
grep current `main` (and `git log <their pin>..main`) for the thing they say
is missing before calling it missing. On zbc, one consumer's reason for a fork
had already been fixed upstream, and fixed more completely than in their copy.
Reporting it as a gap would have meant applying a patch backwards.

**4. Publishing a private consumer's code from a public repo.** Check
`gh repo view --json visibility` for the upstream and every consumer. If the
upstream is public and any consumer is private, gitignore the survey output
**and the cases**. Rewrite a case without client names, private code or error
messages before it becomes an issue, and show the user the rewrite first.

## Setting it up (first run only)

Work out three things from the repo, then confirm them with the user before
writing anything:

1. **What you ship into consumers**, the vendored surfaces: generated or
   copied files, each with the upstream path it comes from and anything your
   generator stamps into it. These get ancestry verdicts.
2. **What consumers write instead**, the novel surfaces and escape hatches:
   files with no upstream counterpart in the places your tool expects
   (`modules/`, `lib/`, `bin/`, `scripts/`), dependencies beyond what your
   scaffold adds, calls to the tool your abstraction wraps (`wrangler`
   beside a Cloudflare module, `fetch(` beside an HTTP helper), and comments
   naming your tool, a workaround or a limit.
3. **Where lived experience is recorded**: run logs, local state databases,
   CI history, commit subjects. Anything that says whether code ran and how
   it failed. zbc weighs "wired into production". croft reads each checkout's
   `.croft/runs.sqlite`. Evidence that ran beats code that sits there.

Then:

- **Registry**: `docs/consumers/registry.json`, hand-maintained. Per
  consumer: `id`, `repo`, `access` (`github` clone, `local:<path>` or
  `ssh:<host>:<path>`, archived at `HEAD`), `root` when the project isn't at
  the repo root, where any local-only state lives, `tier`, `notes`. Find
  candidates by searching for your tool's marker file across `~/Projects` (and
  any other machines the user names), skipping `node_modules` and worktrees
  (`.git` is a file). Discovery is manual on purpose: access and tier are
  facts no script can derive.
- **Collector**: `scripts/consumer-survey.ts`, written in the repo's own
  style. Copy the pure core from `scripts/ancestry.ts` rather than importing
  it from the plugin, so the repo owns its survey. Per consumer it writes
  `.consumer-survey/<id>.json`, then an `index.json` grouped **by surface**,
  plus a usage table of which options and config keys consumers actually
  use. Unit-test the pure functions: verdicts, normalisation, stamps, hatch
  patterns.
- **Project skill**: `.claude/skills/consumer-mining/SKILL.md` that names this
  repo's surfaces, templates, hatch list and exceptions, and carries the rest
  of this method. From then on that skill runs it, not this one.

## Running it

1. **Collect.** Run `bun scripts/consumer-survey.ts`, or name consumers
   while iterating.
2. **Fan out, one agent per consumer that has material** (divergent or novel
   files, hatches, notes, failures). Each agent gets its own JSON and the
   checkout, and this rule: *report only what this repo shows. Do not propose
   upstream changes and do not compare against other consumers. You can't see
   them.* Fixed schema per finding, so the reports merge:
   - **capability**: one line, what they needed that upstream didn't give
   - **surface**: which upstream surface it lands on
   - **evidence**: file:line, the config keys involved, and failures or runs
   - **why upstream fell short**: from the diff and the code, then checked
     against `main` as `still missing`, `fixed since <pin>` or `exists,
     they didn't know` (the last one is a docs case)
   - **exercised?**: production, run history, or none
3. **Synthesise per surface.** This is the only step that sees across
   consumers. Where independent implementations **agree**, that's the
   interface. Where they **disagree**, that's the config surface. Where only
   one went, it's a real edge case or one project's quirk, and saying which
   is the judgment this whole exercise is buying. Weigh **exercised** over
   unexercised and **independent** over copy-paste siblings (two identical
   files in two repos are one data point about the interface, two about the
   need). Count is a ranking signal, never a gate.
4. **Write the cases.** One file per surface (`# <surface> — <new | upgrade |
   docs | distribution>`): what they needed, the interface from N
   implementations, whether it's still missing on main, what it takes
   upstream, and the evidence with file:line. Then a README rollup, one line
   per case, ordered by the weighting.

## Where this stops

It produces cases, not commits. Deciding what to build, and whether a
capability belongs upstream at all, is the user's call against the project's
own bar (its CLAUDE.md, design doc or roadmap). A case that argues its own
promotion has overstepped. It should make the need clear enough that the call
is easy.
