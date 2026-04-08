#!/bin/bash

# Check that plugin versions are bumped when plugin code changes.
# Installed by plugin-version-guard.

PLUGIN_ROOT="plugins"

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Find which plugins have staged changes
CHANGED_PLUGINS=()
for file in $STAGED_FILES; do
  if [[ "$file" == "$PLUGIN_ROOT/"* ]]; then
    # Extract plugin name (first directory under PLUGIN_ROOT)
    plugin_name=$(echo "$file" | cut -d'/' -f2)
    # Add to array if not already present
    if [[ ! " ${CHANGED_PLUGINS[*]} " =~ " $plugin_name " ]]; then
      CHANGED_PLUGINS+=("$plugin_name")
    fi
  fi
done

if [ ${#CHANGED_PLUGINS[@]} -eq 0 ]; then
  exit 0
fi

# For each changed plugin, check if version was bumped
ERRORS=()
for plugin in "${CHANGED_PLUGINS[@]}"; do
  PLUGIN_JSON="$PLUGIN_ROOT/$plugin/.claude-plugin/plugin.json"

  if [ ! -f "$PLUGIN_JSON" ]; then
    continue
  fi

  # Check if plugin.json is in the staged files
  if echo "$STAGED_FILES" | grep -q "^$PLUGIN_JSON$"; then
    # Check if the version field actually changed
    OLD_VERSION=$(git show HEAD:"$PLUGIN_JSON" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
    NEW_VERSION=$(git show :"$PLUGIN_JSON" | grep '"version"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')

    if [ "$OLD_VERSION" != "$NEW_VERSION" ]; then
      # Version was bumped — all good
      continue
    fi
  fi

  ERRORS+=("$plugin")
done

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "ERROR: Plugin code changed without a version bump:"
  echo ""
  for plugin in "${ERRORS[@]}"; do
    echo "  - $plugin ($PLUGIN_ROOT/$plugin/.claude-plugin/plugin.json)"
  done
  echo ""
  echo "Bump the version in plugin.json before committing."
  echo "To skip this check: git commit --no-verify"
  exit 1
fi

exit 0
