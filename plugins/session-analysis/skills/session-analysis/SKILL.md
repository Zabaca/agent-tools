---
name: session-analysis
description: Analyze Claude Code session transcripts to surface patterns, errors, anti-patterns, and skill improvement opportunities. Use when user wants to review their recent Claude Code sessions, find recurring issues, or identify workflow patterns. Triggers include "analyze sessions", "review my sessions", "what patterns", "session analysis", "daily review".
user-invocable: true
argument-hint: "[--window 24h|3d|7d] [--compare] [--output-dir path]"
---

# Session Analysis

Daily (or on-demand) reflective pass over Claude Code session JSONL transcripts. Surfaces recurring errors, anti-patterns, workflow themes, and skill candidates so the user can spot systemic issues, not just one-off bugs. Builds an on-disk log of past analyses, which itself becomes input for longer-horizon trend detection.

The agent runs the analysis directly using bash + python — **do not spawn sub-agents for parsing**. JSONL parsing is mechanical; sub-agents add latency, cost, and noise.

## Inputs

Parse `$ARGUMENTS` for:
- `--window <24h|3d|7d|Nh|Nd>` — time window. Default `24h`.
- `--compare` — also load previous reports from the output dir to look for multi-day patterns. Implied when window > 24h.
- `--output-dir <path>` — where to write reports. Default `~/.claude/session-analysis/`.

Sessions live at `~/.claude/projects/**/*.jsonl`.

## Workflow

### Step 1 — Locate sessions

```bash
find ~/.claude/projects -name '*.jsonl' -type f -newermt "$(date -v-24H '+%Y-%m-%d %H:%M:%S')"
```

Adjust the `-newermt` window per `--window`. On Linux use `-d` instead of `-v-`.

For `--compare`, also list prior reports in the output dir (`*.json`) to feed into the multi-day pass.

### Step 2 — Parse each session

Write a short Python script that streams each JSONL file and extracts:

- **project / cwd** — from the first message's `cwd` field, or the directory name.
- **duration** — last `timestamp` minus first `timestamp`.
- **first user message** — the seed task.
- **tool usage** — count `tool_use` blocks by `name` (Bash, Read, Edit, Write, Agent, Task, etc.).
- **errors** — `tool_result` entries with `is_error: true`; Bash results whose content includes `Exit code` non-zero; user messages that look like rejections ("no", "stop", "don't").
- **sub-agent usage** — count of `Task`/`Agent` tool_use blocks; capture `subagent_type` and `description` to detect fan-out scale and naming patterns.
- **decision arc** — sample user messages roughly evenly across the session to capture pivots.
- **secrets** — regex scan over user-message text for: `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{20,}`, `github_pat_[A-Za-z0-9_]{20,}`, `GOCSPX-[A-Za-z0-9_-]{20,}`, `xox[baprs]-[A-Za-z0-9-]{10,}`, `AKIA[0-9A-Z]{16}`, `Bearer [A-Za-z0-9._-]{20,}`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`. **Record only the secret type and session id — never the secret itself.**

Stream line-by-line; some sessions are large.

### Step 3 — Cross-session analysis

Aggregate across the window:

- **Error patterns** — group errors by normalized message; flag any that appear in 2+ sessions as systemic.
- **Efficiency signals** — tool calls per session, error rate (errors / tool calls), retry loops (same tool + same target ≥ 3× in a row without an intervening edit).
- **Themes** — cluster sessions by project / first-message keywords.
- **Decision points** — pivots, abandoned approaches, restarts.
- **Anti-patterns** to look for explicitly:
  - `Edit` before any `Read` of the same file in that session.
  - Secrets pasted in chat.
  - Retry loops without root-cause investigation (same failing command repeated).
  - Spawn-then-kill agents (`Agent` followed shortly by `TaskStop` for the same id).
  - Excessive `Bash cat/head/tail` instead of `Read`.
- **Skill candidates** — workflows repeated across 2+ sessions that look automatable; cite the sessions as evidence.
- **Causal chains** — session A produces a plan/PR/file; session B picks it up. Detect via shared file paths or PR numbers in messages.

### Step 4 — Compare (when `--compare` or window > 24h)

Load prior `*.json` reports from the output dir. Look for:

- Patterns that **persist** day-over-day (systemic, worth fixing).
- **New** patterns vs **recurring** ones.
- **Trajectories** — e.g. fan-out scaling (6 → 22 → 69 agents), error-rate drift.
- **Causal chains across days**.
- Same errors appearing with no fix in between — flag loudly.

### Step 5 — Output

Write to `$OUTPUT_DIR` (create if missing). Filenames:

- `YYYY-MM-DD.md` — human report.
- `YYYY-MM-DD.json` — structured data.
- `YYYY-MM-DD_to_YYYY-MM-DD_comparison.md` — only in compare mode.

If a same-day file already exists, suffix with `-HHMM`.

#### JSON shape (stable — future runs depend on it)

```json
{
  "version": 1,
  "generated_at": "2026-05-08T12:00:00Z",
  "window": "24h",
  "sessions": [
    {
      "id": "...",
      "project": "...",
      "started_at": "...",
      "duration_seconds": 0,
      "first_user_message": "...",
      "tool_counts": {"Bash": 0, "Read": 0},
      "error_count": 0,
      "subagent_count": 0,
      "summary": "..."
    }
  ],
  "errors": [
    {"signature": "...", "count": 0, "sessions": ["..."], "example": "..."}
  ],
  "patterns": [
    {"kind": "anti-pattern|theme|efficiency", "name": "...", "evidence": ["..."], "recommendation": "..."}
  ],
  "skill_candidates": [
    {"name": "...", "description": "...", "evidence_sessions": ["..."], "frequency": 0}
  ],
  "secrets_detected": [
    {"session": "...", "type": "github_pat"}
  ]
}
```

#### Markdown report sections

1. **Summary** — sessions analyzed, total duration, total tool calls, overall error rate.
2. **Session table** — project | duration | top tools | errors | what it did.
3. **Error patterns** — counts, example, affected sessions, suggested fix.
4. **Anti-patterns detected** — each with evidence + recommendation.
5. **Skill candidates** — repeated workflows, cited sessions.
6. **Cross-session themes**.
7. **(compare)** Multi-day patterns + trajectories.

Every finding ends with an **actionable recommendation**. If there is nothing to recommend, drop the finding.

## Guardrails

- **Never echo secret values** — only the type and session id.
- **Don't spawn sub-agents** for parsing; do it inline.
- **Keep the JSON shape stable** — bump `version` if it must change, and migrate old reports rather than break them.
- **Be concise** — daily reports are read daily; bullets, not essays.
