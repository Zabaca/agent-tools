---
name: setup-stream-kit
description: Configure this repo for the streaming skills — what the product is, where the board lives, the title angles and bank, the links block, and the stream overlay. Run once per project before first use of stream-start.
disable-model-invocation: true
---

# Setup stream kit

Scaffold the per-project configuration that `stream-start`, `stream-metadata`
and `stream-overlay` assume. Those skills carry **mechanics only** — the 60
character title limit, the 150 character snippet rule, the truth rules, the
rotation discipline. Everything that is true of *this product* lives in the repo
and is written here.

Two files get written:

- **`docs/agents/stream.md`** — stable. Product identity, channel, board
  commands, links, hashtags, tags, overlay.
- **`docs/agents/stream-titles.md`** — churns. The angles, the unused bank, the
  Used log. Written on **every** stream, which is why it is separate: a rotation
  log and an identity paragraph should never share a diff.

This is prompt-driven, not a script. Explore, present, confirm, then write.

**What does NOT belong here.** The face reference sheet, the `gemini-image` CLI
path and its API key, and the model tiers are about the *person*, not the
project. They stay in `youtube-thumbnail` and are already project-agnostic.
Never copy them into a repo.

## Process

### 1. Explore

Read what is actually here. Don't assume:

- `git remote -v` — which host, which repo, and the owner handle (the VOD lane
  searches merged PRs by author).
- `git shortlog -sn --all | head` — **who else commits here.** This decides
  Section 0, and it is the one signal you cannot get by asking, because the
  answer people give is about who owns the project rather than who has a
  checkout.
- `gh repo view --json visibility` — public or private.
- Whether the repo already sanctions a personal instructions file:
  `CLAUDE.local.md` in `.gitignore` or `.git/info/exclude`.
- `README.md` first two paragraphs, and `package.json` `name`/`description` —
  this is the raw material for the standing paragraph.
- `CLAUDE.md` / `AGENTS.md` at the root — which exists, and is there already an
  `## Agent skills` section?
- `docs/agents/` — does this skill's prior output already exist? Does the repo
  already use that directory for other agent config?
- Board: is `fredrin` on PATH **and** `FREDRIN_PROJECT` set in the environment?
  Does `gh` resolve issues for this remote? Neither is fine.
- A standup: anything under `docs/standup`, `.scratch/standup`, or a Fredrin
  note whose name mentions standup.
- An overlay: `ls -d apps/*overlay* apps/*stream*` and any server on a fixed
  port. Absent in almost every repo.

### 2. Present findings and ask

Summarise what is present and missing. Then take the sections in order — one
section, one answer, then the next. **Lead each with the recommended answer** so
it can be accepted in a word. Skip a section outright when exploration settled
it.

**Section 0 — Committed, or personal?** Settle this first: it decides where
everything else gets written.

A title bank is a log of clickbait experiments and a channel's private strategy.
In a repo you share with other people, committing it puts that in their checkout
and in the history forever, and every teammate's agent reads it as project
convention.

Recommend from what exploration found, and say the evidence out loud:

- **More than one real contributor** → *personal*. Config at
  `~/.claude/stream/<repo-dir-name>/`, and the pointer goes in a gitignored
  `CLAUDE.local.md` rather than the shared `CLAUDE.md` / `AGENTS.md`.
- **Solo, or everyone is in on the stream** → *committed*. Config at
  `docs/agents/`, pointer in the tracked `CLAUDE.md` / `AGENTS.md`. Versioned,
  backed up by the remote, and it travels with the repo.

Count contributors by human, not by line: one person commonly appears under
several names and emails, and a bot is not a contributor.

The trade the user is making, stated plainly: **committed is durable, personal is
private.** A personal bank is untracked, so it is not on the remote and a
`git clean -fdx` would take it — which is exactly why it lives *outside* the repo
tree rather than being excluded inside it. Say this; do not let them discover it
after a year of Used-log entries is gone.

**Section A — What is this, in two sentences?**

The single highest-value answer in this file. It is pasted into the description
of **every** stream, written for someone who has never heard of the product and
will not watch a second video.

Draft it from the README and present it for correction — do not ask for a blank.
Product language, not engineering: what a person can *do*, never what was built.

> Fredrin is a desktop kanban board where every ticket gets its own branch, its
> own worktree, and its own AI coding agent — so one person can keep a dozen of
> them shipping at once instead of babysitting one terminal.

That is the register. Two to three sentences, no file paths, no flag names.

**Section B — Where the board is.**

Propose from exploration, and record the **literal commands** so the consuming
skills stop carrying another project's:

- `fredrin` on PATH and `FREDRIN_PROJECT` set → the `fredrin tickets list` /
  `fredrin goals list` pair.
- GitHub remote only → `gh issue list` / `gh pr list`.
- Neither → `git log --since` alone, and say so plainly in the file. A stream
  with no board still has a description; it just derives from commits.

Also settle the **standup** here: a path, or the literal word `None`. The
consuming skills prefer a standup over re-deriving when one exists, and a dead
pointer is worse than none.

**Section C — Angles, and a seed bank.**

*Draft* these; do not ask for them blank. An empty bank never gets filled.

The angles are the directions the channel tests, and they come out of Section A.
They are **not** portable — a parallel-agents product and a browser game share
none of them:

| Product | Angles that fit |
|---|---|
| A tool that builds itself | ouroboros, number, refusal, thesis, curiosity gap |
| A multiplayer browser game | the impossible spec, the old-school comparison, the number, the build log, curiosity gap |

Propose four or five angles with a one-line rationale each, then three or four
evergreen titles under each — **about what the product is**, never about what is
on the board today. Character counts in parentheses; under 60.

Apply the truth rules while drafting, and record any that already burned:

- Clickbait is allowed. False is not.
- A claim the product itself contradicts is the one unrecoverable failure.
- Identity claims about the user ("I don't write code anymore") need his
  sign-off and get marked ⚠️ until they have it.
- A number in a title must be showable on screen.

**Section D — Links and hashtags.**

Ask. **Never invent a URL** — a link that does not exist is left out and flagged,
not guessed. Exactly three hashtags (YouTube renders three or none). Then the
tag working set: most specific first, broadest last, always including the exact
product name.

**Section E — Overlay.** Don't ask when exploration found no overlay app — the
normal case. Write the section as `None` with the reason, rather than leaving it
out; the consuming skills read the section's content, and an absent one reads as
a config somebody never finished.

When one exists, record the **absolute** path, the port, and a health check that
actually distinguishes healthy from broken. Verify the check yourself before
writing it: run the server and confirm the check fails when the server is down.
A line the process prints on both the good and the bad path is not a health
check.

### 3. Confirm and edit

Show a draft of `docs/agents/stream.md`, `docs/agents/stream-titles.md`, and the
`### Streaming` block. Let them edit before anything is written.

### 4. Write

**Committed layout — pick the root file to edit:** `CLAUDE.md` if it exists,
else `AGENTS.md`, else ask which to create. Never create one when the other is
already there — and check whether one is a **symlink to the other** before
treating them as two files. If an `## Agent skills` section exists, add the
sub-block inside it rather than starting a second section.

**Personal layout — never touch a tracked file.** The pointer goes in
`CLAUDE.local.md` at the repo root, which Claude Code loads and which repos
conventionally ignore. Confirm it is actually ignored (`git check-ignore -v
CLAUDE.local.md`) before writing; if it is not, add it to `.git/info/exclude` —
the repo-local ignore list, which is itself never committed — rather than to the
shared `.gitignore`. Then write the two config files under
`~/.claude/stream/<repo-dir-name>/`, creating the directory.

```markdown
### Streaming

[product], on [channel]; board read via [tool]; [overlay on :PORT | no overlay].
See `docs/agents/stream.md`.
```

Then write the two config files — under `docs/agents/` or
`~/.claude/stream/<repo-dir-name>/` per Section 0 — from the seed templates in
this skill folder:

- [stream.md](./stream.md)
- [stream-titles.md](./stream-titles.md)

Fill every placeholder. A template shipped with its placeholders intact reads as
configured and is worse than a missing file, because `stream-start` will not
know to stop.

### 5. Done

Say which skills now read these files, and that `docs/agents/*.md` can be edited
by hand later — re-running this is only for starting over or moving the board.

Point out the one ongoing obligation: **after each stream, the result goes on
that title's Used line.** The bank is only worth having because it records what
was tried; a direction shows up across several streams in one angle and cannot
show up at all if nobody wrote the numbers down.
