# .visual-mode

Agent visual output surface, scaffolded by the `visual-mode` plugin
(`zabaca-agent-tools`). Not application code — this directory is gitignored.

- **Panes** (structured): `src/content/panes/YYYY-MM-DD-topic/NN-name.mdx` — MDX
  with a no-import component registry (`Callout`, `Card*`, `Badge`, `Separator`,
  `Chart`, `Mermaid`) + Tailwind v4. Rendered in a session shell with navigation.
- **Lab** (out of bounds): `src/pages/lp/*.astro` using `src/layouts/Lab.astro` —
  full-bleed pages that own all their styling. Auto-listed at `/lp`.

Run: `bun run dev --port <port>` (the `/visual-mode` skill picks a deterministic
port from the repo path). Component registry: `src/pages/[...slug].astro`.
