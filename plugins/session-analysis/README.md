# session-analysis

Analyze Claude Code session JSONL transcripts to surface patterns, errors, anti-patterns, and skill improvement opportunities. Designed to run daily and accumulate a log that itself becomes input for longer-horizon trend detection.

## Usage

```
/session-analysis [--window 24h|3d|7d] [--compare] [--output-dir path]
```

- `--window` — how far back to look. Default `24h`.
- `--compare` — also load prior reports from the output dir to look for multi-day patterns. Implied for windows > 24h.
- `--output-dir` — where reports are written. Default `~/.claude/session-analysis/`.

## What you get

For each run, two artifacts in the output dir:

- `YYYY-MM-DD.md` — human-readable report (session table, error patterns, anti-patterns, skill candidates, themes).
- `YYYY-MM-DD.json` — structured data with a stable schema, so future runs can detect trends across days.

In compare mode you also get `YYYY-MM-DD_to_YYYY-MM-DD_comparison.md` highlighting persistent vs new patterns and workflow trajectories.

## Anti-patterns it watches for

- `Edit` before `Read` on the same file
- Secrets pasted into chat (flagged by type only — values are never recorded)
- Retry loops that don't investigate root cause
- Spawn-then-kill sub-agent churn
- Excessive `Bash cat/head/tail` where `Read` would do

## Notes

- Sessions are read from `~/.claude/projects/**/*.jsonl`.
- JSONL parsing runs inline (bash + python) — no sub-agents.
- Every finding includes an actionable recommendation; if there isn't one, the finding is dropped.
