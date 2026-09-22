---
name: problem
description: Answer with a plain-language Problem / Impact / Solution summary of whatever we have been discussing. Use when the user types /problem, or says "what's the actual problem here", "summarize this simply", "I'm lost", "explain that again plainly", "what does this mean for me". Also use unprompted when a discussion has run long and the user's last message suggests they have lost the thread.
---

# /problem

Collapse the conversation so far into three short sections. Nothing else.

## The shape

```
## The problem
<1-3 sentences.>

## The impact
<1-3 sentences, or up to 3 bullets.>

## Proposed solution
<1-3 sentences, or up to 4 short steps. Name the one you recommend.>
```

Use those exact three headings, in that order. No preamble before them, no summary after them. Target 150 words total; hard ceiling 250.

## Rules for each section

**The problem** — What is actually broken or undecided, stated as a fact about the world, not about the code path that revealed it. One problem. If the conversation surfaced several, pick the one that has to be solved first and say in a single clause that the others are downstream of it.

**The impact** — Who or what is worse off, and how, if this is not fixed. Concrete and observable: a thing that breaks, time lost, money, data, a decision that stays blocked. If the honest answer is "very little", say that — a small impact is a useful answer, not a failure.

**Proposed solution** — What to do, in the order it would be done. One recommendation, stated as a recommendation. If there is a real alternative, give it one sentence and say why you did not pick it. Do not list every option you considered.

## Language rules

These are the point of the skill. They override the habit of sounding thorough.

- Assume the reader has not read the code, the logs, or the earlier messages in this conversation. Write so it stands alone.
- No jargon, acronym, tool name, file path, or symbol name without a short gloss the first time it appears. `semble` becomes "semble, the code-search CLI".
- No terms of art the user did not use first: race condition, idempotent, coupling, surface area, non-deterministic, drift. Say what happens instead.
- Short sentences. One idea each.
- No hedging stacks ("it may possibly be the case that"). If uncertain, say "I'm not sure" and say what would settle it.
- No numbers, versions, or claims you have not verified this session. If a fact matters and is unverified, mark it "unverified".
- No code blocks unless a single command IS the solution. Then one line, no explanation around it.

## What not to do

- Do not narrate the investigation, the dead ends, or what you tried.
- Do not restate the user's question back to them.
- Do not add "Next steps", "Summary", "Note that", or a fourth section.
- Do not soften the problem to be encouraging. Plain is kinder than upbeat.
- Do not ask a clarifying question instead of answering. If something is genuinely unknown, write the three sections with what you have and put the open question as the last line of the solution section.

## If there is no conversation to summarize

The user invoked this with nothing to compress — first message of a session, or after a topic switch. Do not invent a problem. Ask, in one line, which problem they want framed.
