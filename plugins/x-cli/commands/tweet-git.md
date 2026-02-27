---
description: Generate and post a tweet from a git commit
argument-hint: "[commit-hash]"
---

Generate a tweet from a git commit and post it using x-cli.

**Commit:** $ARGUMENTS (defaults to HEAD if empty)

## Process

Step 1: Get commit details via `git log --format="%s%n%n%b" -1 ${ARGUMENTS:-HEAD}`
Step 2: Analyze commit type (feat, fix, refactor, perf, docs)
Step 3: Select tweet angle (Milestone, Debugging Story, Before/After, Numbers, Tool Comparison)
Step 4: Draft tweet under 280 chars with specific details
Step 5: Present draft with character count and ask for approval
Step 6: Post using: bun ${CLAUDE_PLUGIN_ROOT}/packages/x-cli/src/main.ts tweet "TWEET_CONTENT_HERE"

Templates: Learning (TIL), Milestone (Shipped), Numbers, Problem/Solution, Before/After.
