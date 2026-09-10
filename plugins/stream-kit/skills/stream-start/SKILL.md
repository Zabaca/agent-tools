---
name: stream-start
description: One command to go live — reads the board, picks a title from the bank, writes the description and tags, generates thumbnail concepts, restarts the overlay, and hands back a paste-ready block for YouTube's stream setup. Use when the user says they're starting a stream, going live, setting up today's stream, or asks for "everything for the stream".
---

# Stream start

The user is about to go live and wants **one paste-ready block**, not a
conversation. Run the whole chain, make the reasonable calls yourself, and stop
only for the decision that is genuinely his.

This skill **orchestrates**; it does not restate rules. The skills it drives own
their own standards and are authoritative:

- [`stream-metadata`](../stream-metadata/SKILL.md) — title rules, description
  shape, tags, the truth rules.
- [`youtube-thumbnail`](../youtube-thumbnail/SKILL.md) — reference sheet, prompt
  template, model tiers, the mobile legibility test.
- [`stream-overlay`](../stream-overlay/SKILL.md) — the HUD restart and its
  health check. Only when this project has one.

**Read them before running.** Do not reimplement what they say from memory.

## 0. Load the config, or stop

Everything project-specific — what the product is, where the board lives, the
angles, the links, the overlay — is in the config and the bank.

Config lives in **one of two places**. Check in this order and use the first
that exists:

1. **`docs/agents/stream.md`** in this repo — the *committed* layout, for a repo
   you own alone or share only with people who are in on the stream.
2. **`~/.claude/stream/<repo-dir-name>/stream.md`** — the *personal* layout, for
   a repo shared with other contributors. `<repo-dir-name>` is the basename of
   the repo root, so `~/Projects/jaequery/fredrin` → `~/.claude/stream/fredrin/`.

The bank — `stream-titles.md` — always sits **beside** whichever config you
found. Never mix the two layouts.

Below, **the config** means that `stream.md` and **the bank** means that
`stream-titles.md`.

**If neither exists, stop.** Tell the user to run `/setup-stream-kit` once for
this project, and do nothing else. Running on another project's identity is the failure this split exists to
prevent: a description that confidently explains the wrong product, in a block
built to be pasted without reading.

Say which layout you found in one line, so a personal config in a shared repo is
never mistaken for a missing one.

## Order is load-bearing

Title → description → thumbnail → overlay restart. Never reorder:

1. The **title** comes from the evergreen bank and depends on nothing.
2. The **description** depends on today's board — it is the only part that
   changes day to day.
3. The **thumbnail** depends on the title, because its text must *complement*
   the title, never repeat a word of it.
4. The **overlay restart** goes last because it zeroes the on-air clock.

Generating a thumbnail before the title is settled wastes money and produces
text that collides with the title. Restarting the overlay first burns the clock
while he is still pasting metadata.

## The run

### 1. Gather

Run the Board commands from the config. If it names a
standup and one exists for today, read it instead of re-deriving — same facts,
already in product language.

### 2. Pick the title yourself

**Do not present three candidates.** This skill exists so he does not have to
choose. Pick from the bank by rule:

- **Least-recently-tested angle wins.** Read the Used log, find which angle has
  gone longest without a run, take an unused line from it.
- **Ties go to the angle listed first** in the bank's Angles section — which is
  every angle in a fresh bank. Never break a tie by vibe.
- Skip anything marked ⚠️ unless he has already signed off on that claim, and
  anything marked ❌ always.
- Say which angle and why in one line.

Then **log it immediately** — move the line to Used with today's date. A pick
that isn't logged corrupts the next run's rotation.

### 3. Write the description

Pre-live lane. Today's block comes from the board; the standing paragraph and
the links come from the config, pasted rather than rewritten.

### 4. Thumbnail

Derive 2-3 words that carry the *feeling* the title doesn't state, then run
`youtube-thumbnail` with them.

- **Three concepts, different expressions**, at `flash`. Never `pro` for the
  field — see that skill's model table.
- Read every result **and** its `.mobile.png`. A concept that fails at 168x94 is
  dead regardless of how it looks full size.
- Present the finalists with a pick and a reason.

Livestreams get **no A/B test** — YouTube's Test & Compare is VOD-only. One shot,
so favour the clearest strong option over the wildest.

### 5. Restart the overlay — do this LAST

**Only if the config's Overlay section names a path.** A config that says
`None` there has no overlay — that is the normal case, and it is an answer, not
a gap. Skip the step silently: do not mention an overlay that does not exist, and
never go hunting for one in another repo.

When it does, run [`stream-overlay`](../stream-overlay/SKILL.md), as late as
possible and immediately before he hits Go Live. Report exactly what it reports —
including degraded — and tell him the clock reset.

## Ask at most one question

Everything else you decide. The one thing you cannot derive is **what today is
actually about** when the board is ambiguous — several goals live, nothing
obviously in flight, no standup written.

Ask it as one question with the two or three readings the board supports. Do not
ask which title, which thumbnail, whether to save, or whether to proceed.

If the board is clear, ask nothing and deliver.

## Deliver

One block, in this order, each independently copyable:

```md
**Title**
<one line>

**Description**
<full text>

**Tags**
<comma-separated>

**Thumbnail**
<path to the picked file>

**Overlay**
<up on <port>, clock reset — or what failed. Omit this heading entirely if the
project has no overlay.>
```

Then, and only then, the short version of what you chose and why — title angle,
thumbnail pick, anything you assumed. Keep it under five lines; he is about to
go live.

## After the stream

He will come back with numbers. Append the result to that title's line in the
Used log in the bank. **That is the entire point of the
bank** — a direction only shows up across several streams in the same angle, and
it can only show up if the results were written down.
