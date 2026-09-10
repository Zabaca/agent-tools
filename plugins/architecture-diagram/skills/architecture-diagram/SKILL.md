---
name: architecture-diagram
description: Draw a presentation-quality architecture or system diagram as hand-laid-out SVG, verified by rendering it in headless Chrome and looking at the result. Use when asked for a diagram that has to be READ by other people — an architecture map, a request path, a trust boundary, a deployment topology — or when asked to make an existing mermaid/auto-layout diagram "prettier", "cleaner", or "presentable".
---

# Architecture diagrams that are actually readable

Mermaid and other auto-layout tools place nodes to minimise edge crossings. They do not place
them to make an argument. When the whole point of a diagram is *there is exactly one route out of
here* or *this boundary is the security model*, auto-layout cannot make that visually prominent —
it will put the important edge wherever dagre finds convenient and float its label in whitespace.

This skill draws with fixed coordinates instead, and **verifies by rendering rather than by
reading**. That second half is not optional. Every collision found while developing this method was
invisible in the source and obvious in a screenshot.

## When to use auto-layout instead

Reach for mermaid when the diagram is disposable, small (under ~10 nodes), or when the graph
matters and the layout does not — a quick dependency sketch, a state machine, an inline explanation
in a PR. This skill costs 30–60 minutes. Spend it when the diagram will be presented, kept, or
argued over.

Also prefer mermaid when the content will change weekly. Fixed coordinates are a maintenance cost.

## The loop

1. **Gather the facts first, from the source of truth.** Read the terraform, the config, the code.
   Count things rather than estimating them. A diagram that is beautiful and wrong is worse than an
   ugly accurate one, because people believe it.
2. **Plan coordinates on paper before writing markup.** Decide the lanes (usually left-to-right along
   the data flow), then group boxes, then node boxes, then edge routes. Write the numbers down.
3. Write the file — see the structure below.
4. **Render it and LOOK at it** (see "Verify by rendering").
5. Fix what the render shows. Repeat until clean. Budget three rounds; it usually takes three.
6. Deliver: send the PNG, and place the HTML wherever it lives.

## Structure of the file

HTML wrapper, SVG diagram, HTML footer. Text in HTML wraps and styles easily; the SVG holds only
the diagram, so it scales as one unit.

```
<style> … tokens and layout … </style>
<div class="wrap">
  <header>  title + subtitle + status pills  </header>
  <svg viewBox="0 0 W H"> … the diagram … </svg>
  <div class="foot"> 3–4 short columns </div>
</div>
```

Inside the SVG, draw in this order so later things sit on top:

1. group frames (account → cluster → namespace → pod), light fills, nested by containment
2. **edges** — under the nodes, so a line that grazes a box is hidden rather than crossing it
3. nodes, each as `<g filter="url(#sh)"><rect …/></g>` plus separate `<text>` elements
4. free-standing annotations

Define text classes in a `<style>` inside `<defs>` — `.gl` group label, `.nt` node title,
`.ns` node subtitle, `.el` edge label, `.note` annotation. Set them once; never inline font sizes.

### Colour carries meaning, not decoration

Pick 4–6 semantic fills and say what they mean in the legend. What worked:

| role | fill | stroke |
|---|---|---|
| holds a real secret | `#7a2d2d` | `#c76b6b` |
| inside the sandbox / isolated | `#1f3a4d` | `#5b9dc9` |
| ordinary process | `#243447` | `#5b9dc9` |
| identity / IAM | `#4a3a1f` | `#c9a75b` |
| outside the trust boundary | `#2f2f33` | `#8a8a92` |
| denied | text `#b3392f`, dashed stroke |

All with `fill:#fff` titles and `#c9d6e6` monospace subtitles. If the diagram joins a family of
existing ones, **match their palette** rather than the prettiest one — five diagrams that read as
one set beat one that stands out.

### Edges

- Orthogonal only: `M x y H x2 V y2 H x3`. No curves, no diagonals.
- Two weights: `stroke-width="2.4"` `#3f4a5c` for the spine, `1.5` `#7b8798` for detail. A reader
  should be able to trace the main path at a glance.
- Dashed for "derived", "optional", or "denied".
- Route through **gutters** — the gap between two group borders. Note the gutter x once and reuse it.
- Give the arrowhead its own `<marker>` per colour; markers do not inherit stroke.

### Say what is NOT true

The strongest panel in the diagram that prompted this skill was the one listing what the system
**cannot** reach, with the observed evidence beside each line (`403 from the proxy`, `curl exit 56`,
`Forbidden`). Denials are usually the actual argument and usually get one dotted edge. Give them a box.

### Fill dead space with content, not decoration

Large empty regions read as unfinished. Put a numbered "how one request flows" list there, or the
evidence table. Never a logo or a gradient.

## Verify by rendering

**Do not skip this.** Reading SVG source does not tell you whether text overflows its box, whether a
label lands on a line, or whether an edge crosses a label card.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --screenshot=out.png --window-size=<W+60>,<H_est> "file://$PWD/diagram.html"
```

Then **read the PNG back and look at it.** Check specifically:

- edge labels sitting on top of the line they label, or on a group border
- any edge passing through a text block or a label card
- text wider than its box (long node subtitles are the usual culprit)
- an edge whose start or end lands on the wrong node because coordinates drifted
- dead space large enough to read as a mistake

Also worth a cheap programmatic check — parse the SVG with `xml.etree` to confirm it is well-formed,
since a malformed one may render partially rather than failing.

`scripts/render.sh <file.html> [out.png] [width] [height]` wraps both steps. It exits non-zero on a
malformed SVG, and it does NOT judge the picture — reading the PNG is still your job.

`EXAMPLE.html` is a finished diagram built this way: a Kubernetes deployment with three pods, a
trust boundary, an IAM chain, and a denials panel. Read it for the coordinate conventions rather
than starting from a blank file — copying its group/edge/node skeleton saves most of step 2.

## Where it goes

**cedarpad** — place as an `HtmlCard` via `place_component`, passing the file contents as
`data.html`. Size the shape to the *rendered* height, not a guess: measure where the content ends in
the screenshot and scale by `shape_width / window_width`. After placing, verify the stored
`data.html` round-tripped byte-for-byte and that the new box overlaps nothing — text and note shapes
report `w=h=0`, so assume a nominal box for them rather than letting a zero-area comparison pass
trivially.

**Anywhere else** — the file is self-contained HTML with no external requests, so it works as an
artifact, an attachment, or a file in the repo.

## Superseding an existing diagram

Prefer adding beside it over editing it, and relabel the old one with what it was true of
("BEFORE", "as of v19"). A superseded diagram is a record of what was believed at the time; editing
it in place erases that a decision was ever made. Say in the new one's caption what it supersedes.

## Traps

- **A diagram captioned "as deployed" must match what is deployed**, not what is committed. If a
  rename is merged but unapplied, draw the old name and note the pending change.
- Re-derive counts at drawing time. "20 upstreams" was counted with `yaml.safe_load`; the number in
  the prose was stale.
- Keep node subtitles under ~40 characters. Almost every overflow found in review was a subtitle.
- Fixed coordinates mean moving one box moves its labels and both its edge endpoints. Change the
  group's y and shift its children by the same delta in one pass, not box by box.
