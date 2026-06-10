---
name: visual-mode
description: Start visual mode — an astro dev server that renders the agent's output as browsable web panes. Scaffolds .visual-mode/ on first run, starts the server on a deterministic per-repo port, and teaches the agent the pane/lab conventions. Use when the user invokes /visual-mode, asks to "visualize" something in the browser, or wants rendered/visual output instead of chat text.
user-invocable: true
---

# Visual Mode

Visual mode gives the agent a **visual output surface**: a local astro app in
`.visual-mode/` (gitignored) where responses are written as files and rendered
live in the browser. Two surfaces, one server:

1. **Panes (structured)** — MDX documents with rich components, grouped by
   session in a navigable shell. For explanations, comparisons, reports,
   proposals.
2. **Lab (out of bounds)** — full-bleed `.astro` pages that own 100% of their
   markup and styling. For mockups, landing pages, design exploration — anything
   that must escape the shell.

## Setup / start (run both; they're idempotent)

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/visual-mode/scripts/bootstrap.sh "${CLAUDE_PLUGIN_ROOT}"
```

Then start the server **in the background** (use your backgrounded-shell
mechanism — the script runs in the foreground):

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/visual-mode/scripts/start.sh
```

Get the port anytime with `start.sh --port-only` (deterministic hash of the repo
path, range 4300–5299 — multiple repos/worktrees can run visual mode at once).
If the server is already running, `start.sh` exits 0 with `already-running:`.
Tell the user the URL once it's up.

## Writing panes (structured)

Create session folders + numbered files under `.visual-mode/src/content/panes/`:

```
.visual-mode/src/content/panes/YYYY-MM-DD-topic/01-name.mdx
                                                02-followup.mdx
```

- One session folder per conversation/topic (date-prefixed, kebab-case); one
  numbered file per response. The left rail groups by session automatically.
- Frontmatter: just `title:` (schema-less — extra fields are fine).
- URL = `/<session-folder>/<file-name-without-extension>`.

**Components available with NO imports** (registry:
`.visual-mode/src/pages/[...slug].astro` — extend it there if needed):

| Component | Use |
| --- | --- |
| `<Callout type="info\|success\|warning" title="…">` | highlighted asides |
| `<Card>` + `CardHeader/Title/Description/Content/Footer` | grouped content |
| `<Badge>`, `<Separator>` | labels, dividers |
| `<Mermaid chart={`…`} />` | flowcharts, sequence diagrams |
| `<Chart …>` | recharts-backed data viz |

Plus **Tailwind v4 via `className`** on raw JSX/HTML — arbitrary custom layouts
inside panes are encouraged (grids, mock UI, colored cards). Markdown tables,
GFM, and code blocks all work.

## Writing lab pages (out of bounds)

For full-bleed work, create `.visual-mode/src/pages/lp/<name>.astro`:

```astro
---
import Lab from "@/layouts/Lab.astro";
---
<Lab title="My experiment">
  <!-- you own everything here: full-width sections, custom nav, any design -->
</Lab>
```

- `Lab` = bare HTML + global CSS only. No prose constraints, no shell.
- Pages are auto-listed at `/lp` and in the floating bottom switcher — no
  registration needed.
- Pages may import the host repo's own components/data via relative paths.

## Verification (do not trust a 200 alone)

The template's `freshFileWatcher` (astro.config.mjs) handles the common failure
mode — Tailwind's source scan going stale for files created after server start —
by invalidating the CSS on every file add. Still, after writing a file, verify
the **compiled CSS** contains a distinctive utility you used (grepping the raw
HTML is not enough; classes appear there even when uncompiled):

```bash
curl -s http://localhost:$PORT/<path> | awk '/<style/,/<\/style>/' | grep -c "some-distinctive-class"
```

If `0`: kill the dev server, `rm -rf .visual-mode/node_modules/.vite`, restart
via `start.sh`, and re-check.

## Conventions

- Always give the user the full clickable URL to anything you create.
- Don't edit template internals (`Shell.astro`, `panes.ts`) unless asked —
  extend via panes, lab pages, or the component registry.
- The `0000-00-00-welcome` session is template documentation; leave it unless
  the user asks to remove it.
- `.visual-mode/` is gitignored by design: panes are session artifacts, not
  project code. Don't commit it unless the user explicitly opts in.
