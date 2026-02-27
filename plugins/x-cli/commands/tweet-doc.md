---
description: Generate and post a tweet from a research document
argument-hint: <file-path>
---

Generate a tweet from a research document and post it using x-cli.

**Document:** $ARGUMENTS

## Process

Step 1: Read the document (handles docs/ paths or topic names)
Step 2: Extract key content - main topic, key findings, unique angle, actionable takeaway
Step 3: Select tweet angle based on document type (how-to, comparison, framework, research, list)
Step 4: Draft tweet under 280 chars using one of the provided template formats
Step 5: Present draft to user with character count and ask for approval
Step 6: Post using: bun ${CLAUDE_PLUGIN_ROOT}/packages/x-cli/src/main.ts tweet "TWEET_CONTENT_HERE"

Tweet templates: Insight share, Framework share, Comparison insight, Thread teaser.
