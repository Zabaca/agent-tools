---
name: stream-metadata
description: Write the title, description, chapters, and tags for a build-in-public YouTube stream, derived from real board state rather than invented. Use when the user asks what to call a stream, wants a stream title or YouTube description, is about to go live, or is publishing the VOD of a stream they already ran.
---

# Stream metadata (title, description, chapters, tags)

The metadata's job is to make a stranger scrolling YouTube stop, and to make the
person who stopped understand what they are about to watch inside two lines.

**Derive it, don't invent it.** Every claim in the title and the first paragraph
must trace to something on the board, in the standup, or in the git log. A title
promising a thing that does not happen on stream is the one failure mode that
costs the channel.

## Where the project's facts live

This skill carries **mechanics only** — the limits, the shape, the truth rules.
Everything true of *this product* lives outside it.

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

The config holds the standing paragraph, the channel, the board commands, the
standup, the links block, the hashtags and the tags. The bank holds the angles,
the titles and the Used log.

**If neither exists, stop.** Tell the user to run `/setup-stream-kit` once for
this project, and do nothing else. Do not draft from another project's identity and do not improvise one — a
confident description of the wrong product is worse than no description.

Companion skills: [`youtube-thumbnail`](../youtube-thumbnail/SKILL.md) consumes
the title this skill produces — **write the title first, thumbnail second.**
[`stream-start`](../stream-start/SKILL.md) drives both end to end for a go-live;
when invoked from there, **pick one title by rotation instead of proposing
three.**

## Two lanes

Ask which, or infer from tense. They read the same data at different times.

| Lane | When | Description covers |
|---|---|---|
| **Pre-live** | Before going live | Today's plan — the *intent*. No chapters. |
| **VOD** | After the stream ended | What actually landed — the *outcome*, plus chapters. |

**The lane changes the description, not the title.** Titles come from the
evergreen bank and stay put — a stream that went sideways does not need a new
title, it needs a corrected *Today* block. Rewrite the title for the VOD only if
the day produced something genuinely remarkable enough to earn an episode title.

## Gather first

Do not draft before running the Board commands from the config.
Timestamps are UTC; the user is US Pacific, so "today" is 07:00Z → next 07:00Z.
The VOD lane also runs the config's VOD commands — what merged during the window,
across every Worker branch and not just `main`.

If the config names a standup and one exists for the day, read it instead of
re-deriving. It is the same facts already translated into product language.

## Title

### Essence, not episode

**The title sells what the product is. The description sells what today is.** A
viewer scrolling YouTube has never heard of it and does not care which ticket is
in flight — the name of a feature flag means nothing to them. What stops them is
the premise.

So titles are **evergreen and reusable**, drawn from
the bank, not composed fresh from the day's board. Today's
work still has to be real — it just lives in the description.

The one exception: a genuinely remarkable day (a launch, a public failure, a
number nobody would believe) earns an episode title. That is rare. Default to
the bank.

### Working the bank

The channel is testing **direction**, not optimizing one line. Titles get used
roughly one per stream until an angle starts working.

1. Read the bank.
2. Propose **3 unused** candidates from **different angles**.
3. On pick, move that line to **Used** with the date and angle.
4. Add fresh candidates whenever a new framing appears — the bank should grow.
5. Only call a direction a winner after several streams in the same angle. One
   good stream is not signal.

### Rules, in priority order

1. **Under 60 characters.** YouTube truncates around there on mobile, which is
   most of the audience. 100 is the hard cap; treat 60 as the real one.
2. **Front-load the hook in the first 3 words.** The tail gets cut.
3. **Clickbait is allowed. False is not.** An exaggeration a viewer can verify on
   screen is fine; a claim the product contradicts is not. Check every factual
   assertion against what the product actually does — the burned claims are
   logged in the bank's truth-rules section, and they are there because each one
   read as obviously true until someone checked.
4. **Identity claims need his sign-off.** "I don't write code anymore", "I never
   open my editor" — only usable while true. Ask, don't assume.
5. **Concrete over abstract.** A number, a named thing — not "improvements",
   "productivity", "the future of coding".
6. **No ticket identifiers, no PR numbers, no file paths, ever.**
7. **No "Day N of…" as the lead.** It sorts the video into a series a new viewer
   is not in. If he wants continuity, it goes at the *end*, after the hook.

### Angles

The bank is grouped by angles, and they are **defined per project** in
the bank — they come out of what the product is, so a tool
that builds itself and a multiplayer browser game share none of them. Always
propose across at least three of whatever that file lists.

Give a one-line reason for the pick. Pick by which angle hasn't been tested
lately, not by vibe; the bank states the tie-break.

### Pairing with the thumbnail

Title and thumbnail must never say the same thing — **title is the what, thumbnail
is the feeling.** Hand the thumbnail skill 2-3 words that complement the title
rather than repeat it: "I built an app that builds itself" → `ITSELF`, not
`BUILDS ITSELF`.

## Description

**Shape.** Everything above `---` is what the viewer sees before clicking *more*.

```md
<One sentence: what happens in this stream. Ends before character 150.>
<One sentence: why it matters / what's at stake.>

---

<Standing paragraph — paste the Product section of the config.>

Today:
- <plan or outcome, one line each, 2-4 lines>

Chapters
00:00 <…>

<Links block — paste verbatim from the config.>

<The 3 hashtags from the config.>
```

**Rules:**

- The **first 150 characters** are the search snippet and the collapsed preview.
  They must stand alone with no context. Do not open with "In this stream…".
- **Say what the product is every single time.** Assume zero prior videos
  watched. That paragraph lives in the config so it is consistent
  across streams — paste it. If the framing has genuinely moved, update that file
  rather than improvising a one-off.
- **Product language, not engineering.** Say what a user can do, not what was
  changed. No flag names, no env vars, no file paths.
- Ticket identifiers are **allowed only** inside a chapter line where the ticket
  is literally on screen, and even then prefer the human title.
- 5000 character cap. Realistically aim for 800-1500.
- **Exactly 3 hashtags**, last line. YouTube renders the first 3 above the title;
  more than 3 and it renders none.

## Chapters

Only for the VOD lane. A live stream has no chapters until it ends.

- First chapter **must** be `00:00`, or YouTube ignores the whole list.
- Minimum **3** chapters; each at least **10 seconds** long.
- Label by what a viewer would scrub to, not by ticket: "The build breaks", "Why
  I stopped uploading conversations", "Publishing to npm, live".
- If the recording was not marked up, say chapters are unavailable rather than
  guessing timestamps. **Never fabricate a timestamp.**

## Tags

- 500 characters total across all tags — that is the real limit, not a count.
- Order matters: most specific first, broadest last.
- Start from the working set in the config and prune to fit.
- Include the exact product name. Include the two or three concrete nouns from
  the title.

## Links

The config holds the standing links block. Paste it verbatim.
**Never invent a URL** — if a link the description wants is not in that file yet,
leave it out and tell the user it is missing.

## Worked example

From a different project — read it for **shape**, not content. The product here
is a desktop kanban that runs many AI coding agents in parallel; its board that
day had a "No GitHub account required" path built but switched off, and a free
local-only version never published to npm.

**Title candidates** — from the bank, three different angles, none used yet:
1. I built an app that builds itself — *ouroboros*
2. 12 AI agents. One guy. One screen. — *number*
3. Writing code was never the bottleneck — *thesis*

**Pick: 1.** The ouroboros angle is that channel's actual premise and hadn't been
tested; it also survives a day that goes sideways, which the board suggested it
might. Note what the title does **not** do: it says nothing about GitHub or
sign-ups. That belongs in *Today*.

```md
I built a whole "you don't need a GitHub account" path into my product and then
left it switched off. Today I turn it on.

---

Fredrin is a desktop kanban board where every ticket gets its own branch, its own
worktree, and its own AI coding agent — so one person can keep a dozen of them
shipping at once instead of babysitting one terminal. I'm building it in public.

Today:
- Fixing every screen that tells you to reconnect GitHub when you never had an account.
- Getting the free, local-only version ready to publish so anyone can install it with one command.

#vibecoding #buildinpublic #aiagents
```

The standing paragraph and the hashtags there are **that project's**, pasted from
its own config. Yours come from yours.

## Finally

Print title candidates, description, and tags in chat as copy-paste blocks. Say
which title you'd pick and why.

**Then log the pick** — move the chosen line into the **Used** section of
the bank with the date and angle. The bank is only worth
having if it records what was tried; a title proposed twice because nobody wrote
it down is the failure mode.

**Never post to YouTube** — hand the text over.
