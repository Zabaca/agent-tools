# matrix-agent

Dispatch a parameterized prompt across the cartesian product of N dimensions, run each cell as an isolated sub-agent, then synthesize cross-cutting patterns.

## Install

This plugin lives in the `zabaca-agent-tools` marketplace. Once the marketplace is added to Claude Code, install with:

```
/plugin install matrix-agent
```

## Usage

```
/matrix-agent --template "Audit {route} for {rule}" \
  --dim route=/auth/login,/payment/charge,/admin/settings \
  --dim rule=no-hardcoded-creds,rate-limiting,auth-required \
  --output github-issues
```

Conversational form works too:

> Run a matrix agent: template is "Generate docs for {package} using {style}", dimensions are package=contract-flow,betr-auth,x9-parsing and style=with-toc,no-toc. Output a comparison report.

## What it does

1. **Setup** — parse template + dimensions, expand matrix, preview, confirm.
2. **Dispatch** — fan out one sub-agent per cell with bounded concurrency, retry once on failure.
3. **Collect + synthesize** — build a results matrix, find cross-cutting patterns, emit a report, GitHub issues, or comparison view.

Each sub-agent only sees its own slice. The synthesizer sees everything and is where the insight comes from.

## Output modes

- `report` (default) — markdown matrix + insights + per-cell appendix
- `github-issues` — one issue per actionable finding via `gh`
- `comparison` — side-by-side, good for A/B-style runs

See [`skills/matrix-agent/SKILL.md`](skills/matrix-agent/SKILL.md) for the full workflow.
