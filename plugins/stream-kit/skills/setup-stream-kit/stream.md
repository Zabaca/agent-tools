# Streaming

Configuration for the streaming skills — `stream-start`, `stream-metadata`,
`stream-overlay`. Everything true of *this product* lives here; the skills carry
only mechanics.

The title bank and its rotation log are in
[`stream-titles.md`](./stream-titles.md), separate because that file is written
on every stream.

## Product

<!-- Two to three sentences, for someone who has never heard of this and will
     not watch a second video. Pasted into every description, above the fold.
     Product language: what a person can do, never what was built. -->

[PRODUCT PARAGRAPH]

## Channel

- Channel: [NAME / URL]
- Author handle (for merged-PR searches): `[HANDLE]`

## Board

The gather commands. Run these before drafting anything; timestamps are UTC and
the user is US Pacific, so "today" is 07:00Z → next 07:00Z.

```bash
[BOARD COMMANDS]
```

VOD lane additions — what actually landed during the stream window:

```bash
[VOD COMMANDS]
```

**Standup:** [PATH, or `None`]. When one exists for the day, read it instead of
re-deriving — same facts, already in product language.

## Links

Pasted verbatim into every description. Edit this block when a link changes.
**Never invent a URL** — if the description wants a link that is not here, leave
it out and say it is missing.

```
[LINKS]
```

## Hashtags

Exactly three, last line of the description. YouTube renders the first three
above the title; more than three and it renders none.

```
[HASHTAGS]
```

## Tags

500 characters total across all tags — that is the real limit, not a count.
Most specific first, broadest last. Prune to fit.

[TAGS]

## Overlay

<!-- Keep this section either way. With no overlay, write exactly:

       **None.** <one line on why, and what must not be pointed at this repo.>

     Write `None` rather than deleting the heading: the consuming skills read
     this section's CONTENT, an absent section reads as an unfinished config,
     and the reason is what stops someone later aiming another repo's HUD here. -->

- Path: `[ABSOLUTE PATH]`
- Port: `[PORT]`
- Start: `[START COMMAND]`
- Health: `[CHECK]` — must return [EXPECTED]

[What the overlay resets on boot, and anything the user has to do in OBS.]
