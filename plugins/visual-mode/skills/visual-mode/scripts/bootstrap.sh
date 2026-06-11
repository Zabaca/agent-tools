#!/usr/bin/env bash
# Scaffold .visual-mode/ into the current repo from the plugin template.
# Usage: bootstrap.sh <plugin-root>   (idempotent — safe to re-run)
set -euo pipefail

PLUGIN_ROOT="${1:?usage: bootstrap.sh <plugin-root>}"
TEMPLATE="$PLUGIN_ROOT/template"
TARGET=".visual-mode"

[ -d "$TEMPLATE" ] || { echo "ERROR: template not found at $TEMPLATE" >&2; exit 1; }
command -v bun >/dev/null || { echo "ERROR: bun is required (https://bun.sh)" >&2; exit 1; }

if [ -d "$TARGET/src" ]; then
  echo "exists: $TARGET already scaffolded — skipping copy"
else
  cp -R "$TEMPLATE" "$TARGET"
  echo "scaffolded: $TARGET"
fi

# Gitignore the whole surface (decision: panes are session artifacts, not project code).
if [ -d .git ] || git rev-parse --git-dir >/dev/null 2>&1; then
  if ! grep -qx "\.visual-mode/" .gitignore 2>/dev/null; then
    printf "\n# agent visual output surface (visual-mode plugin)\n.visual-mode/\n" >> .gitignore
    echo "gitignored: added .visual-mode/ to .gitignore"
  fi
fi

cd "$TARGET"
if [ ! -d node_modules ]; then
  echo "installing dependencies (bun install)…"
  bun install --silent
fi
echo "ready: $TARGET"
