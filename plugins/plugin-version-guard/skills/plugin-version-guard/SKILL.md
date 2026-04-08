---
name: plugin-version-guard
description: Sets up a git pre-commit hook that ensures plugin versions are bumped when plugin code changes. Use when the user wants to enforce version bumps in a Claude Code plugin marketplace.
user-invocable: true
argument-hint: "[--dry-run]"
---

# Plugin Version Guard

Sets up Husky and a pre-commit hook that blocks commits when files inside a plugin directory change but the plugin's version in `plugin.json` was not bumped.

## Workflow

### 1. Detect Project Context

Read these files to understand the project:

```
.claude-plugin/marketplace.json  — confirm this is a plugin marketplace
package.json                     — check if husky is already installed
.husky/pre-commit                — check if a pre-commit hook already exists
```

Determine:
- **Package manager**: Look for `bun.lock` (bun), `pnpm-lock.yaml` (pnpm), `yarn.lock` (yarn), or `package-lock.json` (npm). Default to npm if unclear.
- **Plugin root**: Read `marketplace.json` → `metadata.pluginRoot` to find where plugins live. Default to `./plugins`.
- **Existing hooks**: If `.husky/pre-commit` exists, we'll append rather than overwrite.

If `marketplace.json` does not exist, stop and tell the user this skill is designed for Claude Code plugin marketplace repos.

### 2. Install Husky

If `husky` is not in `devDependencies`:

```bash
# For bun:
bun add -D husky

# For npm:
npm install -D husky

# For pnpm:
pnpm add -D husky

# For yarn:
yarn add -D husky
```

Then initialize:

```bash
npx husky init
```

If `package.json` does not exist, create one first:

```bash
# For bun:
bun init -y

# For npm:
npm init -y
```

### 3. Create the Pre-Commit Check Script

Write the following script to `.husky/check-plugin-versions.sh` and make it executable (`chmod +x`).

Adapt the `PLUGIN_ROOT` variable to match the value from `marketplace.json` → `metadata.pluginRoot` (default: `plugins`).

```bash
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
```

### 4. Wire Up the Pre-Commit Hook

Edit `.husky/pre-commit` to call the check script. If the file already has content, append to it. If it was just initialized by Husky (contains only `npm test`), replace the content.

The `.husky/pre-commit` file should contain:

```bash
.husky/check-plugin-versions.sh
```

### 5. Update marketplace.json Version

If the `plugin-version-guard` plugin itself is listed in `marketplace.json`, remind the user that this plugin was just set up and they should commit the changes.

### 6. Report

Print a summary:
- Package manager detected
- Husky installed (or was already installed)
- Pre-commit hook created at `.husky/pre-commit`
- Check script created at `.husky/check-plugin-versions.sh`
- Plugin root being watched: `$PLUGIN_ROOT`
- Remind: teammates get the hook automatically when they run `install`

If `--dry-run` was passed as an argument, do NOT execute any commands or write any files. Instead, print what would be done.
