# machine-first-prototype

Give the agent screenshots of an app. It infers the domain, models the parts that
are genuinely stateful as XState machines, proves them with a headless assertion
script, and only then builds UI — delivering three renderings of the same
machines:

- **Bare** — no design system. Every control generated from `snapshot.can()`, so
  a missing button means the machine refuses that event.
- **Designed** — the design system, matching the screenshot's structure and
  density rather than its pixels.
- **States** — one card per machine state, each the real component driven by a
  real actor parked there, with a coverage check against the machine's own
  exported state list.

## Why the order matters

The machines are written and verified before any component exists. Across the
builds this skill was distilled from, that phase caught an undo window that was
decorative, a compose actor that never finished, and a guard that could never
fail — none of which are visible in a rendered screenshot.

## Files

| File | What it holds |
| --- | --- |
| `skills/machine-first-prototype/SKILL.md` | The pipeline and the modelling heuristics |
| `skills/machine-first-prototype/PATTERNS.md` | XState v5 recipes: parallel regions, undo windows, child pruning, freezing for the explorer |
| `skills/machine-first-prototype/SCAFFOLD.md` | Project scaffold, drive-script template, CDP browser driver |

## Install

```
/plugin install machine-first-prototype@zabaca-agent-tools
```
