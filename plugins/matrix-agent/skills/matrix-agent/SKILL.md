---
name: matrix-agent
description: Dispatch parameterized prompts across a matrix of dimensions. Use when user wants to fan out work across combinations of variables — A/B tests, audits across routes/rules, docs generation across packages/styles, any cartesian product of tasks.
user-invocable: true
argument-hint: "<template> --dim <name>=<val1>,<val2> [--dim ...] [--output format]"
---

# Matrix Agent

Fan out a parameterized prompt across the cartesian product of N dimensions, run each cell as an isolated sub-agent, then synthesize cross-cutting patterns from the collected results. Individual agents see only their slice; the synthesizer sees everything.

Use this when the user wants to:
- Audit M routes against N rules
- Generate docs for M packages in N styles
- A/B test variants of the same task
- Any task shaped like a cartesian product

## Invocation

Slash form:
```
/matrix-agent --template "Audit {route} for {rule}" \
  --dim route=/auth/login,/payment/charge,/admin/settings \
  --dim rule=no-hardcoded-creds,rate-limiting,auth-required \
  --output github-issues
```

Conversational form: parse the user's request for a template string and `name=v1,v2,...` dimensions.

## Phase 1: SETUP

1. **Parse** the template prompt and each `--dim name=val1,val2,...`. Trim whitespace around values; preserve case.
2. **Expand the matrix.** Compute the cartesian product of every dimension. The total cell count is `∏ |dim_i|`.
3. **Sanity-check size.** If the matrix has > 25 cells, warn the user and ask whether to proceed, narrow dimensions, or sample.
4. **Show the expansion.** Print:
   - Dimensions and their values
   - Total cell count: `N agents (D1 × D2 × ...)`
   - The first 3 rendered prompts as a preview
   - Concurrency plan (default: 4 in flight)
   - Output format
5. **Wait for confirmation.** Do not dispatch until the user approves.

## Phase 2: DISPATCH

1. **Name each agent** by joining its dimension values with `_`, slugifying (lowercase, non-alphanumerics → `-`, collapse repeats). Example: `route=/payment/charge` + `rule=rate-limiting` → `payment-charge_rate-limiting`. Names must be unique within the run.
2. **Render each prompt.** Substitute every `{dim}` token with that cell's value. Also support:
   - `{_index}` — 1-based cell number
   - `{_total}` — total cells
   If the template references a variable not in the dimensions, fail fast before dispatch.
3. **Concurrency.** Dispatch in batches; default 4 in flight (configurable via `--concurrency N`). When a slot frees, start the next pending cell.
4. **Each agent gets ONLY its slice.** Do NOT include the full matrix, sibling cells, or aggregate context in the sub-agent prompt. Just the rendered template plus a short "respond with concrete findings, no preamble" suffix.
5. **Track status** per cell: `pending → running → complete | failed`.
6. **Retry once.** If a cell fails (error, empty output, or obvious refusal), re-dispatch it once. If it fails again, mark `failed` and continue — never abort the whole run for one bad cell.
7. **Use `Agent` (fork) tool calls** with no `subagent_type` so each cell runs in the background and its tool noise stays out of the orchestrator's context. Send batches in a single message with multiple Agent tool uses to start them in parallel.

## Phase 3: COLLECT + SYNTHESIZE

1. **Validate** each returned result: non-empty, addresses the prompt, not a refusal. Mark unusable returns as `failed` and trigger the retry path if not already retried.
2. **Build the results matrix.** For 2-dimensional runs, a table with rows = dim1, columns = dim2, cell = short verdict (✓ / ✗ / summary phrase). For higher dimensions, project onto the two most informative axes and list the rest as facets.
3. **Look for cross-cutting patterns:**
   - Which dim value had the most issues? (`route /payment/charge failed 4 of 6 rules`)
   - Which dim value was cleanest?
   - Correlations across cells (`rate-limiting is missing on every route`)
   - Outliers vs. the modal result
4. **Generate the deliverable** based on `--output`:
   - `report` (default) — markdown summary: dimensions used, results matrix table, top 3–5 insights, per-cell appendix with each agent's findings.
   - `github-issues` — file one GitHub issue per actionable finding. Title: `[{dim1}] {dim2}: {summary}`. Body includes the rendered prompt and the agent's full output. Use `gh issue create`. Confirm with the user before filing if there are more than 5 issues.
   - `comparison` — side-by-side comparison view, useful for A/B experiments where dimensions are variants of the same artifact.

### Example matrix output

```
| route\rule       | no-hardcoded-creds | rate-limiting | auth-required |
|------------------|--------------------|---------------|----------------|
| /auth/login      | ✓ clean            | ✗ missing     | ✓ clean        |
| /payment/charge  | ✗ CRITICAL         | ✗ missing     | ✗ no auth      |
| /admin/settings  | ✓ clean            | ✓ present     | ✗ no auth      |
```

## Design rules

- **Slice isolation.** Each sub-agent sees only its rendered prompt, never the matrix or peer results. The synthesizer is the only place that sees everything.
- **Naming.** `{slug(dim1-val)}_{slug(dim2-val)}...` — stable and trackable in logs.
- **Resilience.** One failed cell does not fail the run. Retry once, then continue.
- **No leakage of `_index`/`_total`** unless the template explicitly references them.
- **Don't peek** at fork transcripts mid-flight. Trust the completion notifications.
- **Synthesis is the value.** A run that returns the matrix without insights is incomplete — always include cross-cutting observations in the report.
