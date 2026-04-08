#!/bin/bash
set -e

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  exit 0
fi

# Get status (porcelain for machine-readable output)
STATUS=$(git status --porcelain)

if [ -z "$STATUS" ]; then
  # Clean — allow stop
  exit 0
fi

# Dirty — block stop and tell Claude what to do
echo "Git working tree is not clean. You must either commit the changes or add them to .gitignore before stopping." >&2
echo "" >&2
echo "Uncommitted changes:" >&2
echo "$STATUS" >&2
exit 2
